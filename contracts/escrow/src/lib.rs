use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, ext_contract, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, NearSchema};

const GAS_FOR_CROSS_CONTRACT: Gas = Gas::from_tgas(10);
const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(15);

/// Escrow status
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum EscrowStatus {
    Active,
    Released,
    Disputed,
    Refunded,
}

/// Escrow entry
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct EscrowEntry {
    pub id: String,
    pub invoice_id: String,
    pub seller: AccountId,
    pub buyer: AccountId,
    pub sale_amount: U128,
    pub invoice_amount: U128,
    pub created_at: u64,
    pub due_date: u64,
    pub status: EscrowStatus,
    pub settled_at: Option<u64>,
    pub dispute_reason: Option<String>,
    /// Whether USDC funds have been deposited into this escrow
    #[serde(default)]
    pub funds_deposited: bool,
}

/// Escrow statistics view
#[derive(Serialize, Deserialize, NearSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct EscrowStats {
    pub total_escrows: u64,
    pub active_escrows: u64,
    pub total_value_locked: U128,
    pub total_settled: u64,
    pub total_disputed: u64,
}

/// Cross-contract interface for Invoice contract
#[ext_contract(ext_invoice)]
pub trait InvoiceContract {
    fn mark_settled(&mut self, invoice_id: String);
}

/// Cross-contract interface for USDC (NEP-141 Fungible Token)
#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

/// Escrow Contract
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EscrowContract {
    escrows: IterableMap<String, EscrowEntry>,
    escrows_by_invoice: LookupMap<String, String>,
    escrows_by_buyer: LookupMap<AccountId, Vec<String>>,
    escrows_by_seller: LookupMap<AccountId, Vec<String>>,
    escrow_count: u64,

    invoice_contract: AccountId,
    marketplace_contract: AccountId,
    usdc_contract: AccountId,
    admin: AccountId,
}

#[near]
impl EscrowContract {
    /// Initialize the escrow contract
    #[init]
    pub fn new(
        invoice_contract: AccountId,
        marketplace_contract: AccountId,
        usdc_contract: AccountId,
        admin: AccountId,
    ) -> Self {
        Self {
            escrows: IterableMap::new(b"e"),
            escrows_by_invoice: LookupMap::new(b"i"),
            escrows_by_buyer: LookupMap::new(b"b"),
            escrows_by_seller: LookupMap::new(b"s"),
            escrow_count: 0,
            invoice_contract,
            marketplace_contract,
            usdc_contract,
            admin,
        }
    }

    /// NEP-141 callback: Receive USDC tokens from marketplace
    /// Message format: "escrow_deposit:INV-000001"
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

        // Verify the sender is the marketplace
        assert!(
            sender_id == self.marketplace_contract,
            "Only marketplace can deposit to escrow"
        );

        // Parse the message to get invoice ID
        let parts: Vec<&str> = msg.split(':').collect();
        if parts.len() >= 2 && parts[0] == "escrow_deposit" {
            let invoice_id = parts[1];

            // Find the escrow for this invoice and mark funds as deposited
            if let Some(escrow_id) = self.escrows_by_invoice.get(invoice_id).cloned() {
                if let Some(mut escrow) = self.escrows.get(&escrow_id).cloned() {
                    // Verify amount matches expected
                    assert!(
                        amount.0 >= escrow.sale_amount.0,
                        "Insufficient deposit amount"
                    );

                    escrow.funds_deposited = true;
                    self.escrows.insert(escrow_id.clone(), escrow);

                    env::log_str(&format!(
                        "Escrow {} funded with {} USDC",
                        escrow_id, amount.0
                    ));
                }
            }
        }

        // Accept all funds (return 0 to keep everything)
        PromiseOrValue::Value(U128(0))
    }

    /// Create escrow entry (called by marketplace after sale)
    pub fn create_escrow(
        &mut self,
        invoice_id: String,
        seller: AccountId,
        buyer: AccountId,
        sale_amount: U128,
        invoice_amount: U128,
        due_date: u64,
    ) -> String {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.marketplace_contract || caller == self.admin,
            "Only marketplace can create escrow"
        );

        // Check if escrow already exists for this invoice
        assert!(
            self.escrows_by_invoice.get(&invoice_id).is_none(),
            "Escrow already exists for this invoice"
        );

        self.escrow_count += 1;
        let id = format!("ESC-{:06}", self.escrow_count);

        let entry = EscrowEntry {
            id: id.clone(),
            invoice_id: invoice_id.clone(),
            seller: seller.clone(),
            buyer: buyer.clone(),
            sale_amount,
            invoice_amount,
            created_at: env::block_timestamp_ms(),
            due_date,
            status: EscrowStatus::Active,
            settled_at: None,
            dispute_reason: None,
            funds_deposited: false, // Will be set to true when USDC arrives via ft_on_transfer
        };

        self.escrows.insert(id.clone(), entry);
        self.escrows_by_invoice.insert(invoice_id, id.clone());

        // Update buyer index
        let mut buyer_escrows = self
            .escrows_by_buyer
            .get(&buyer)
            .cloned()
            .unwrap_or_default();
        buyer_escrows.push(id.clone());
        self.escrows_by_buyer.insert(buyer, buyer_escrows);

        // Update seller index
        let mut seller_escrows = self
            .escrows_by_seller
            .get(&seller)
            .cloned()
            .unwrap_or_default();
        seller_escrows.push(id.clone());
        self.escrows_by_seller.insert(seller, seller_escrows);

        env::log_str(&format!("Escrow {} created", id));
        id
    }

    /// Settle escrow - release funds to investor (buyer)
    /// When debtor pays the full invoice amount, the buyer receives their investment return
    pub fn settle(&mut self, escrow_id: String) -> Promise {
        let caller = env::predecessor_account_id();
        let mut entry = self
            .escrows
            .get(&escrow_id)
            .expect("Escrow not found")
            .clone();

        assert!(
            entry.status == EscrowStatus::Active,
            "Escrow is not active"
        );

        // Allow seller, buyer, or admin to trigger settlement
        // In production, this would require proof of payment from debtor
        assert!(
            caller == entry.seller || caller == entry.buyer || caller == self.admin,
            "Unauthorized"
        );

        // Verify funds were deposited
        assert!(
            entry.funds_deposited,
            "No funds deposited in escrow"
        );

        entry.status = EscrowStatus::Released;
        entry.settled_at = Some(env::block_timestamp_ms());
        self.escrows.insert(escrow_id.clone(), entry.clone());

        env::log_str(&format!(
            "Escrow {} settled: {} USDC released to buyer {}",
            escrow_id, entry.invoice_amount.0, entry.buyer
        ));

        // Transfer USDC to buyer (they get the full invoice amount as debtor paid)
        // Note: In a real scenario, the debtor payment would come in separately
        // For now, we release the sale_amount (what buyer paid) back to them
        // The profit would come from the debtor paying the invoice_amount
        ext_ft::ext(self.usdc_contract.clone())
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .ft_transfer(
                entry.buyer.clone(),
                entry.sale_amount, // Return the buyer's investment
                Some(format!("settlement:{}", escrow_id)),
            )
            .then(
                ext_invoice::ext(self.invoice_contract.clone())
                    .with_static_gas(GAS_FOR_CROSS_CONTRACT)
                    .mark_settled(entry.invoice_id)
            )
    }

    /// Simulate debtor payment (for demo purposes)
    /// In production, this would be handled by off-chain payment detection
    pub fn simulate_debtor_payment(&mut self, escrow_id: String) -> Promise {
        // Anyone can trigger this in demo mode
        // In production, this would be restricted to oracles or verified payment processors

        let entry = self
            .escrows
            .get(&escrow_id)
            .expect("Escrow not found")
            .clone();

        assert!(
            entry.status == EscrowStatus::Active,
            "Escrow is not active"
        );

        env::log_str(&format!(
            "Debtor payment received for escrow {}: {} USDC",
            escrow_id, entry.invoice_amount.0
        ));

        // Auto-settle after payment
        self.settle(escrow_id)
    }

    /// Open a dispute
    pub fn open_dispute(&mut self, escrow_id: String, reason: String) {
        let caller = env::predecessor_account_id();
        let mut entry = self
            .escrows
            .get(&escrow_id)
            .expect("Escrow not found")
            .clone();

        assert!(
            entry.status == EscrowStatus::Active,
            "Escrow is not active"
        );
        assert!(
            caller == entry.buyer || caller == entry.seller,
            "Only buyer or seller can open dispute"
        );
        assert!(!reason.is_empty(), "Dispute reason required");

        entry.status = EscrowStatus::Disputed;
        entry.dispute_reason = Some(reason.clone());
        self.escrows.insert(escrow_id.clone(), entry);

        env::log_str(&format!(
            "Dispute opened for escrow {}: {}",
            escrow_id, reason
        ));
    }

    /// Resolve dispute (admin only) - transfers USDC to winner
    pub fn resolve_dispute(&mut self, escrow_id: String, winner: AccountId) -> Promise {
        let caller = env::predecessor_account_id();
        assert!(caller == self.admin, "Only admin can resolve disputes");

        let mut entry = self
            .escrows
            .get(&escrow_id)
            .expect("Escrow not found")
            .clone();
        assert!(
            entry.status == EscrowStatus::Disputed,
            "Escrow is not disputed"
        );
        assert!(
            winner == entry.buyer || winner == entry.seller,
            "Winner must be buyer or seller"
        );

        // Verify funds were deposited
        assert!(
            entry.funds_deposited,
            "No funds deposited in escrow"
        );

        let invoice_id = entry.invoice_id.clone();
        let seller = entry.seller.clone();
        let buyer = entry.buyer.clone();
        let buyer_wins = winner == buyer;

        if buyer_wins {
            // Refund buyer - they get their sale_amount back
            entry.status = EscrowStatus::Refunded;
            env::log_str(&format!(
                "Dispute resolved: {} USDC refunded to buyer {}",
                entry.sale_amount.0, buyer
            ));
        } else {
            // Release to seller - buyer's payment goes to seller
            entry.status = EscrowStatus::Released;
            env::log_str(&format!(
                "Dispute resolved: {} USDC released to seller {}",
                entry.sale_amount.0, seller
            ));
        }

        entry.settled_at = Some(env::block_timestamp_ms());
        self.escrows.insert(escrow_id.clone(), entry.clone());

        // Transfer USDC to the winner
        let recipient = if buyer_wins { buyer } else { seller.clone() };

        ext_ft::ext(self.usdc_contract.clone())
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .ft_transfer(
                recipient,
                entry.sale_amount,
                Some(format!("dispute_resolution:{}", escrow_id)),
            )
            .then(
                // Update invoice status based on resolution
                if !buyer_wins {
                    ext_invoice::ext(self.invoice_contract.clone())
                        .with_static_gas(GAS_FOR_CROSS_CONTRACT)
                        .mark_settled(invoice_id)
                } else {
                    // If buyer wins, create a no-op promise
                    Promise::new(env::current_account_id())
                }
            )
    }

    /// Check if escrow is past due date
    pub fn check_overdue(&self, escrow_id: String) -> bool {
        let entry = self.escrows.get(&escrow_id).expect("Escrow not found");
        entry.status == EscrowStatus::Active && env::block_timestamp_ms() > entry.due_date
    }

    /// Mark escrow as overdue (can be used to auto-open disputes)
    pub fn mark_overdue(&mut self, escrow_id: String) {
        let entry = self.escrows.get(&escrow_id).expect("Escrow not found").clone();

        assert!(
            entry.status == EscrowStatus::Active,
            "Escrow is not active"
        );
        assert!(
            env::block_timestamp_ms() > entry.due_date,
            "Escrow is not overdue"
        );

        // Auto-open dispute for overdue escrow
        self.open_dispute(
            escrow_id,
            format!("Auto-dispute: Payment overdue since {}", entry.due_date),
        );
    }

    /// Update admin (current admin only)
    pub fn set_admin(&mut self, new_admin: AccountId) {
        let caller = env::predecessor_account_id();
        assert!(caller == self.admin, "Only admin can change admin");
        self.admin = new_admin;
    }

    /// Update contract addresses (admin only)
    pub fn set_contract_addresses(
        &mut self,
        invoice_contract: Option<AccountId>,
        marketplace_contract: Option<AccountId>,
        usdc_contract: Option<AccountId>,
    ) {
        let caller = env::predecessor_account_id();
        assert!(caller == self.admin, "Only admin can update contracts");

        if let Some(addr) = invoice_contract {
            self.invoice_contract = addr;
        }
        if let Some(addr) = marketplace_contract {
            self.marketplace_contract = addr;
        }
        if let Some(addr) = usdc_contract {
            self.usdc_contract = addr;
        }
    }

    // ============ VIEW METHODS ============

    /// Get escrow by ID
    pub fn get_escrow(&self, escrow_id: String) -> Option<EscrowEntry> {
        self.escrows.get(&escrow_id).cloned()
    }

    /// Get escrow by invoice
    pub fn get_escrow_by_invoice(&self, invoice_id: String) -> Option<EscrowEntry> {
        self.escrows_by_invoice
            .get(&invoice_id)
            .and_then(|id| self.escrows.get(id).cloned())
    }

    /// Get escrows by buyer
    pub fn get_escrows_by_buyer(&self, buyer: AccountId) -> Vec<EscrowEntry> {
        self.escrows_by_buyer
            .get(&buyer)
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|id| self.escrows.get(id).cloned())
            .collect()
    }

    /// Get escrows by seller
    pub fn get_escrows_by_seller(&self, seller: AccountId) -> Vec<EscrowEntry> {
        self.escrows_by_seller
            .get(&seller)
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|id| self.escrows.get(id).cloned())
            .collect()
    }

    /// Get all active escrows
    pub fn get_active_escrows(&self, from_index: u64, limit: u64) -> Vec<EscrowEntry> {
        self.escrows
            .iter()
            .filter(|(_, entry)| entry.status == EscrowStatus::Active)
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(_, entry)| entry.clone())
            .collect()
    }

    /// Get disputed escrows (admin view)
    pub fn get_disputed_escrows(&self) -> Vec<EscrowEntry> {
        self.escrows
            .iter()
            .filter(|(_, entry)| entry.status == EscrowStatus::Disputed)
            .map(|(_, entry)| entry.clone())
            .collect()
    }

    /// Get overdue escrows
    pub fn get_overdue_escrows(&self) -> Vec<EscrowEntry> {
        let now = env::block_timestamp_ms();
        self.escrows
            .iter()
            .filter(|(_, entry)| entry.status == EscrowStatus::Active && now > entry.due_date)
            .map(|(_, entry)| entry.clone())
            .collect()
    }

    /// Get escrow statistics
    pub fn get_stats(&self) -> EscrowStats {
        let mut active_count = 0u64;
        let mut active_value = 0u128;
        let mut settled_count = 0u64;
        let mut disputed_count = 0u64;

        for (_, entry) in self.escrows.iter() {
            match entry.status {
                EscrowStatus::Active => {
                    active_count += 1;
                    active_value += entry.sale_amount.0;
                }
                EscrowStatus::Released => settled_count += 1,
                EscrowStatus::Disputed => disputed_count += 1,
                EscrowStatus::Refunded => settled_count += 1,
            }
        }

        EscrowStats {
            total_escrows: self.escrow_count,
            active_escrows: active_count,
            total_value_locked: U128(active_value),
            total_settled: settled_count,
            total_disputed: disputed_count,
        }
    }

    /// Get escrow count
    pub fn get_escrow_count(&self) -> u64 {
        self.escrow_count
    }

    /// Get admin address
    pub fn get_admin(&self) -> AccountId {
        self.admin.clone()
    }

    /// Get contract addresses
    pub fn get_contract_addresses(&self) -> (AccountId, AccountId, AccountId) {
        (
            self.invoice_contract.clone(),
            self.marketplace_contract.clone(),
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
        builder.predecessor_account_id(predecessor);
        builder
    }

    #[test]
    fn test_init() {
        let invoice: AccountId = "invoice.testnet".parse().unwrap();
        let marketplace: AccountId = "marketplace.testnet".parse().unwrap();
        let usdc: AccountId = "usdc.testnet".parse().unwrap();
        let admin: AccountId = "admin.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let contract = EscrowContract::new(invoice, marketplace, usdc, admin.clone());

        assert_eq!(contract.get_escrow_count(), 0);
        assert_eq!(contract.get_admin(), admin);
    }

    #[test]
    fn test_create_escrow() {
        let invoice: AccountId = "invoice.testnet".parse().unwrap();
        let marketplace: AccountId = "marketplace.testnet".parse().unwrap();
        let usdc: AccountId = "usdc.testnet".parse().unwrap();
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let seller: AccountId = "seller.testnet".parse().unwrap();
        let buyer: AccountId = "buyer.testnet".parse().unwrap();

        let context = get_context(marketplace.clone());
        testing_env!(context.build());

        let mut contract = EscrowContract::new(invoice, marketplace, usdc, admin);

        let escrow_id = contract.create_escrow(
            "INV-000001".to_string(),
            seller.clone(),
            buyer.clone(),
            U128(1_850_000_000), // $1,850
            U128(2_000_000_000), // $2,000
            env::block_timestamp_ms() + 30 * 24 * 60 * 60 * 1000,
        );

        assert_eq!(escrow_id, "ESC-000001");

        let escrow = contract.get_escrow(escrow_id).unwrap();
        assert_eq!(escrow.seller, seller);
        assert_eq!(escrow.buyer, buyer);
        assert_eq!(escrow.status, EscrowStatus::Active);
        assert!(!escrow.funds_deposited); // Funds not deposited yet
    }
}
