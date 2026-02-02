use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PromiseOrValue, NearSchema};

const GAS_FOR_CROSS_CONTRACT: Gas = Gas::from_tgas(10);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(15);

/// Marketplace listing
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct Listing {
    pub id: String,
    pub invoice_id: String,
    pub seller: AccountId,
    pub asking_price: U128,
    pub min_price: Option<U128>,
    pub invoice_amount: U128,
    pub due_date: u64,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub active: bool,
}

/// Combined listing with calculated fields for frontend
#[derive(Serialize, Deserialize, NearSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct ListingView {
    pub listing: Listing,
    pub discount_percentage: f64,
    pub days_until_due: i64,
    pub annualized_yield: f64,
}

/// Bid on a listing
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct Bid {
    pub id: String,
    pub listing_id: String,
    pub bidder: AccountId,
    pub amount: U128,
    pub created_at: u64,
    pub active: bool,
}

/// Cross-contract interface for Invoice contract
#[ext_contract(ext_invoice)]
pub trait InvoiceContract {
    fn set_listed(&mut self, invoice_id: String);
    fn transfer_invoice(&mut self, invoice_id: String, new_owner: AccountId);
    fn unlist_invoice(&mut self, invoice_id: String);
}

/// Cross-contract interface for Escrow contract
#[ext_contract(ext_escrow)]
pub trait EscrowContract {
    fn create_escrow(
        &mut self,
        invoice_id: String,
        seller: AccountId,
        buyer: AccountId,
        sale_amount: U128,
        invoice_amount: U128,
        due_date: u64,
    ) -> String;
}

/// Cross-contract interface for USDC (NEP-141 Fungible Token)
#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> U128;
}

/// Marketplace Contract
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MarketplaceContract {
    listings: IterableMap<String, Listing>,
    listings_by_invoice: LookupMap<String, String>,
    bids: IterableMap<String, Vec<Bid>>,
    listing_count: u64,
    bid_count: u64,

    invoice_contract: AccountId,
    escrow_contract: AccountId,
    usdc_contract: AccountId,

    fee_basis_points: u16,
    fee_recipient: AccountId,
}

#[near]
impl MarketplaceContract {
    /// Initialize the marketplace
    #[init]
    pub fn new(
        invoice_contract: AccountId,
        escrow_contract: AccountId,
        usdc_contract: AccountId,
        fee_recipient: AccountId,
    ) -> Self {
        Self {
            listings: IterableMap::new(b"l"),
            listings_by_invoice: LookupMap::new(b"i"),
            bids: IterableMap::new(b"b"),
            listing_count: 0,
            bid_count: 0,
            invoice_contract,
            escrow_contract,
            usdc_contract,
            fee_basis_points: 100, // 1% fee
            fee_recipient,
        }
    }

    /// List an invoice for sale
    #[payable]
    pub fn list_invoice(
        &mut self,
        invoice_id: String,
        asking_price: U128,
        invoice_amount: U128,
        due_date: u64,
        min_price: Option<U128>,
        expires_at: Option<u64>,
    ) -> Promise {
        let seller = env::predecessor_account_id();

        // Validate
        assert!(asking_price.0 > 0, "Asking price must be greater than 0");
        assert!(
            asking_price.0 <= invoice_amount.0,
            "Asking price cannot exceed invoice amount"
        );

        // Check if invoice is already listed
        assert!(
            self.listings_by_invoice.get(&invoice_id).is_none(),
            "Invoice already listed"
        );

        self.listing_count += 1;
        let id = format!("LST-{:06}", self.listing_count);

        let listing = Listing {
            id: id.clone(),
            invoice_id: invoice_id.clone(),
            seller: seller.clone(),
            asking_price,
            min_price,
            invoice_amount,
            due_date,
            created_at: env::block_timestamp_ms(),
            expires_at,
            active: true,
        };

        self.listings.insert(id.clone(), listing);
        self.listings_by_invoice.insert(invoice_id.clone(), id.clone());

        env::log_str(&format!("Listing {} created for invoice {}", id, invoice_id));

        // Call invoice contract to mark as listed
        ext_invoice::ext(self.invoice_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .set_listed(invoice_id)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_list_callback(id),
            )
    }

    #[private]
    pub fn on_list_callback(
        &mut self,
        listing_id: String,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> String {
        match result {
            Ok(_) => {
                env::log_str(&format!("Listing {} confirmed", listing_id));
                listing_id
            }
            Err(_) => {
                // Rollback: remove listing if invoice contract call failed
                if let Some(listing) = self.listings.get(&listing_id).cloned() {
                    self.listings.remove(&listing_id);
                    self.listings_by_invoice.remove(&listing.invoice_id);
                }
                env::panic_str("Failed to mark invoice as listed");
            }
        }
    }

    /// NEP-141 callback: Receive USDC tokens for purchasing invoices
    /// Message format: "buy_listing:LST-000001" or "place_bid:LST-000001:amount"
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        // Verify the caller is the USDC contract
        let token_contract = env::predecessor_account_id();
        assert!(
            token_contract == self.usdc_contract,
            "Only USDC token transfers accepted"
        );

        // Parse the message
        let parts: Vec<&str> = msg.split(':').collect();
        assert!(parts.len() >= 2, "Invalid message format. Use 'buy_listing:LST-000001'");

        let action = parts[0];
        let listing_id = parts[1].to_string();

        match action {
            "buy_listing" => self.process_usdc_purchase(sender_id, amount, listing_id),
            "place_bid" => {
                // For bids, we could hold the USDC, but for simplicity,
                // we'll keep the bid metadata-only approach
                env::panic_str("Bidding with USDC not yet implemented. Use buy_listing.");
            }
            _ => {
                env::panic_str("Unknown action. Use 'buy_listing:LST-000001'");
            }
        }
    }

    /// Process a USDC purchase of an invoice listing
    fn process_usdc_purchase(
        &mut self,
        buyer: AccountId,
        payment: U128,
        listing_id: String,
    ) -> PromiseOrValue<U128> {
        let listing = self
            .listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();

        assert!(listing.active, "Listing is not active");
        assert!(listing.seller != buyer, "Cannot buy your own listing");

        if let Some(expires_at) = listing.expires_at {
            assert!(
                env::block_timestamp_ms() < expires_at,
                "Listing has expired"
            );
        }

        // Verify payment amount
        assert!(
            payment.0 >= listing.asking_price.0,
            "Insufficient payment. Required: {}, Received: {}",
            listing.asking_price.0,
            payment.0
        );

        // Calculate excess payment to refund
        let excess = payment.0 - listing.asking_price.0;

        // Deactivate listing
        let mut updated_listing = listing.clone();
        updated_listing.active = false;
        self.listings.insert(listing_id.clone(), updated_listing);
        self.listings_by_invoice.remove(&listing.invoice_id);

        env::log_str(&format!(
            "Invoice {} purchased by {} for {} USDC via ft_transfer_call",
            listing.invoice_id,
            buyer,
            listing.asking_price.0
        ));

        // Transfer invoice ownership and create escrow
        // The USDC is already in this contract, we need to forward it to escrow
        let transfer_promise = ext_ft::ext(self.usdc_contract.clone())
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .ft_transfer(
                self.escrow_contract.clone(),
                listing.asking_price,
                Some(format!("escrow_deposit:{}", listing.invoice_id)),
            );

        let invoice_transfer = ext_invoice::ext(self.invoice_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .transfer_invoice(listing.invoice_id.clone(), buyer.clone());

        let escrow_creation = ext_escrow::ext(self.escrow_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .create_escrow(
                listing.invoice_id,
                listing.seller,
                buyer,
                listing.asking_price,
                listing.invoice_amount,
                listing.due_date,
            );

        // Chain the promises: transfer USDC to escrow, then transfer invoice, then create escrow record
        // Note: We detach the promise chain and return excess immediately
        // The cross-contract calls will happen asynchronously
        let _ = transfer_promise.then(invoice_transfer).then(escrow_creation);

        // Return excess payment (will be refunded to sender)
        PromiseOrValue::Value(U128(excess))
    }

    /// Buy an invoice at asking price (LEGACY - use ft_transfer_call to USDC contract instead)
    /// Kept for backwards compatibility during transition
    #[payable]
    pub fn buy_invoice(&mut self, listing_id: String) -> Promise {
        let buyer = env::predecessor_account_id();
        let listing = self
            .listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();

        assert!(listing.active, "Listing is not active");
        assert!(listing.seller != buyer, "Cannot buy your own listing");

        if let Some(expires_at) = listing.expires_at {
            assert!(
                env::block_timestamp_ms() < expires_at,
                "Listing has expired"
            );
        }

        // For demo: accept any attached NEAR as "payment"
        // In production: integrate with USDC ft_transfer_call
        let payment = env::attached_deposit();
        assert!(
            payment >= NearToken::from_millinear(1),
            "Must attach payment"
        );

        // Deactivate listing
        let mut updated_listing = listing.clone();
        updated_listing.active = false;
        self.listings.insert(listing_id.clone(), updated_listing);
        self.listings_by_invoice.remove(&listing.invoice_id);

        env::log_str(&format!(
            "Invoice {} purchased by {} for {}",
            listing.invoice_id,
            buyer,
            listing.asking_price.0
        ));

        // Transfer invoice ownership and create escrow
        ext_invoice::ext(self.invoice_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .transfer_invoice(listing.invoice_id.clone(), buyer.clone())
            .then(
                ext_escrow::ext(self.escrow_contract.clone())
                    .with_static_gas(GAS_FOR_CROSS_CONTRACT)
                    .create_escrow(
                        listing.invoice_id,
                        listing.seller,
                        buyer,
                        listing.asking_price,
                        listing.invoice_amount,
                        listing.due_date,
                    ),
            )
    }

    /// Cancel a listing
    pub fn cancel_listing(&mut self, listing_id: String) -> Promise {
        let caller = env::predecessor_account_id();
        let listing = self
            .listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();

        assert!(listing.seller == caller, "Only seller can cancel listing");
        assert!(listing.active, "Listing is not active");

        // Deactivate listing
        let mut updated_listing = listing.clone();
        updated_listing.active = false;
        self.listings.insert(listing_id.clone(), updated_listing);
        self.listings_by_invoice.remove(&listing.invoice_id);

        // Refund any bids
        if let Some(bids) = self.bids.get(&listing_id).cloned() {
            for bid in bids {
                if bid.active {
                    env::log_str(&format!("Refunding bid {} to {}", bid.id, bid.bidder));
                    // In production: refund USDC to bidder
                }
            }
        }

        env::log_str(&format!("Listing {} cancelled", listing_id));

        // Call invoice contract to unlist
        ext_invoice::ext(self.invoice_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .unlist_invoice(listing.invoice_id)
    }

    /// Place a bid on a listing
    #[payable]
    pub fn place_bid(&mut self, listing_id: String, amount: U128) -> String {
        let bidder = env::predecessor_account_id();
        let listing = self
            .listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();

        assert!(listing.active, "Listing is not active");
        assert!(listing.seller != bidder, "Cannot bid on your own listing");

        if let Some(min_price) = listing.min_price {
            assert!(amount.0 >= min_price.0, "Bid below minimum price");
        }

        // For demo: accept any attached NEAR
        // In production: require USDC deposit
        let deposit = env::attached_deposit();
        assert!(
            deposit >= NearToken::from_millinear(1),
            "Must attach deposit for bid"
        );

        self.bid_count += 1;
        let bid_id = format!("BID-{:06}", self.bid_count);

        let bid = Bid {
            id: bid_id.clone(),
            listing_id: listing_id.clone(),
            bidder,
            amount,
            created_at: env::block_timestamp_ms(),
            active: true,
        };

        let mut listing_bids = self.bids.get(&listing_id).cloned().unwrap_or_default();
        listing_bids.push(bid);
        self.bids.insert(listing_id, listing_bids);

        env::log_str(&format!("Bid {} placed", bid_id));
        bid_id
    }

    /// Accept a bid (seller only)
    #[payable]
    pub fn accept_bid(&mut self, listing_id: String, bid_id: String) -> Promise {
        let caller = env::predecessor_account_id();
        let listing = self
            .listings
            .get(&listing_id)
            .expect("Listing not found")
            .clone();

        assert!(listing.seller == caller, "Only seller can accept bids");
        assert!(listing.active, "Listing is not active");

        let bids = self.bids.get(&listing_id).expect("No bids found").clone();
        let bid = bids
            .iter()
            .find(|b| b.id == bid_id && b.active)
            .expect("Bid not found or inactive")
            .clone();

        // Deactivate listing
        let mut updated_listing = listing.clone();
        updated_listing.active = false;
        self.listings.insert(listing_id.clone(), updated_listing);
        self.listings_by_invoice.remove(&listing.invoice_id);

        // Deactivate all bids and refund non-winning bids
        let updated_bids: Vec<Bid> = bids
            .into_iter()
            .map(|mut b| {
                if b.active && b.id != bid_id {
                    env::log_str(&format!("Refunding bid {} to {}", b.id, b.bidder));
                    // In production: refund USDC
                }
                b.active = false;
                b
            })
            .collect();
        self.bids.insert(listing_id.clone(), updated_bids);

        env::log_str(&format!(
            "Bid {} accepted for listing {}",
            bid_id, listing_id
        ));

        // Transfer invoice and create escrow
        ext_invoice::ext(self.invoice_contract.clone())
            .with_static_gas(GAS_FOR_CROSS_CONTRACT)
            .transfer_invoice(listing.invoice_id.clone(), bid.bidder.clone())
            .then(
                ext_escrow::ext(self.escrow_contract.clone())
                    .with_static_gas(GAS_FOR_CROSS_CONTRACT)
                    .create_escrow(
                        listing.invoice_id,
                        listing.seller,
                        bid.bidder,
                        bid.amount,
                        listing.invoice_amount,
                        listing.due_date,
                    ),
            )
    }

    /// Cancel a bid (bidder only)
    pub fn cancel_bid(&mut self, listing_id: String, bid_id: String) {
        let caller = env::predecessor_account_id();
        let mut bids = self.bids.get(&listing_id).expect("No bids found").clone();

        let bid_idx = bids
            .iter()
            .position(|b| b.id == bid_id)
            .expect("Bid not found");

        assert!(bids[bid_idx].bidder == caller, "Only bidder can cancel bid");
        assert!(bids[bid_idx].active, "Bid is not active");

        bids[bid_idx].active = false;
        self.bids.insert(listing_id, bids);

        env::log_str(&format!("Bid {} cancelled", bid_id));
        // In production: refund USDC to bidder
    }

    /// Update fee (admin only)
    pub fn set_fee_basis_points(&mut self, fee_basis_points: u16) {
        assert!(fee_basis_points <= 1000, "Fee cannot exceed 10%");
        self.fee_basis_points = fee_basis_points;
    }

    // ============ VIEW METHODS ============

    /// Get all active listings with calculated fields
    pub fn get_active_listings(&self, from_index: u64, limit: u64) -> Vec<ListingView> {
        let now = env::block_timestamp_ms();

        self.listings
            .iter()
            .filter(|(_, listing)| listing.active)
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(_, listing)| {
                let discount = if listing.invoice_amount.0 > 0 {
                    ((listing.invoice_amount.0 - listing.asking_price.0) as f64
                        / listing.invoice_amount.0 as f64)
                        * 100.0
                } else {
                    0.0
                };

                let days_until_due = ((listing.due_date as i64) - (now as i64)) / (24 * 60 * 60 * 1000);

                let annualized_yield = if days_until_due > 0 {
                    (discount / days_until_due as f64) * 365.0
                } else {
                    0.0
                };

                ListingView {
                    listing: listing.clone(),
                    discount_percentage: discount,
                    days_until_due,
                    annualized_yield,
                }
            })
            .collect()
    }

    /// Get listing by ID
    pub fn get_listing(&self, listing_id: String) -> Option<Listing> {
        self.listings.get(&listing_id).cloned()
    }

    /// Get listing by invoice ID
    pub fn get_listing_by_invoice(&self, invoice_id: String) -> Option<Listing> {
        self.listings_by_invoice
            .get(&invoice_id)
            .and_then(|id| self.listings.get(id).cloned())
    }

    /// Get bids for a listing
    pub fn get_bids(&self, listing_id: String) -> Vec<Bid> {
        self.bids
            .get(&listing_id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|bid| bid.active)
            .collect()
    }

    /// Get listings by seller
    pub fn get_listings_by_seller(&self, seller: AccountId) -> Vec<Listing> {
        self.listings
            .iter()
            .filter(|(_, listing)| listing.seller == seller)
            .map(|(_, listing)| listing.clone())
            .collect()
    }

    /// Get listing count
    pub fn get_listing_count(&self) -> u64 {
        self.listing_count
    }

    /// Get active listing count
    pub fn get_active_listing_count(&self) -> u64 {
        self.listings
            .iter()
            .filter(|(_, listing)| listing.active)
            .count() as u64
    }

    /// Get fee basis points
    pub fn get_fee_basis_points(&self) -> u16 {
        self.fee_basis_points
    }

    /// Get contract addresses
    pub fn get_contract_addresses(&self) -> (AccountId, AccountId, AccountId) {
        (
            self.invoice_contract.clone(),
            self.escrow_contract.clone(),
            self.usdc_contract.clone(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_millinear(100));
        builder
    }

    #[test]
    fn test_init() {
        let invoice: AccountId = "invoice.testnet".parse().unwrap();
        let escrow: AccountId = "escrow.testnet".parse().unwrap();
        let usdc: AccountId = "usdc.testnet".parse().unwrap();
        let fee_recipient: AccountId = "fees.testnet".parse().unwrap();

        let context = get_context(fee_recipient.clone());
        testing_env!(context.build());

        let contract = MarketplaceContract::new(invoice, escrow, usdc, fee_recipient);

        assert_eq!(contract.get_listing_count(), 0);
        assert_eq!(contract.get_fee_basis_points(), 100);
    }
}
