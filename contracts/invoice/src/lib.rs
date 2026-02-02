use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault};
use near_sdk::NearSchema;

/// Invoice status enum
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum InvoiceStatus {
    Draft,
    Listed,
    Sold,
    Settled,
    Disputed,
    Cancelled,
}

/// Invoice data structure
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct Invoice {
    pub id: String,
    pub creator: AccountId,
    pub owner: AccountId,
    pub amount: U128,
    pub currency: String,
    pub debtor_name: String,
    pub debtor_email: Option<String>,
    pub description: String,
    pub due_date: u64,
    pub created_at: u64,
    pub documents_hash: String,
    pub status: InvoiceStatus,
    pub risk_score: u8,
}

/// Invoice NFT Contract
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct InvoiceContract {
    invoices: IterableMap<String, Invoice>,
    invoices_by_creator: LookupMap<AccountId, Vec<String>>,
    invoices_by_owner: LookupMap<AccountId, Vec<String>>,
    invoice_count: u64,
    marketplace_contract: AccountId,
    escrow_contract: AccountId,
}

#[near]
impl InvoiceContract {
    /// Initialize the contract
    #[init]
    pub fn new(marketplace_contract: AccountId, escrow_contract: AccountId) -> Self {
        Self {
            invoices: IterableMap::new(b"i"),
            invoices_by_creator: LookupMap::new(b"c"),
            invoices_by_owner: LookupMap::new(b"o"),
            invoice_count: 0,
            marketplace_contract,
            escrow_contract,
        }
    }

    /// Create a new invoice
    #[payable]
    pub fn create_invoice(
        &mut self,
        amount: U128,
        debtor_name: String,
        debtor_email: Option<String>,
        description: String,
        due_date: u64,
        documents_hash: String,
    ) -> String {
        // Require small deposit for storage
        let deposit = env::attached_deposit();
        assert!(
            deposit >= NearToken::from_millinear(10),
            "Requires 0.01 NEAR deposit for storage"
        );

        let creator = env::predecessor_account_id();
        self.invoice_count += 1;
        let id = format!("INV-{:06}", self.invoice_count);

        // Validate inputs
        assert!(!debtor_name.is_empty(), "Debtor name required");
        assert!(!description.is_empty(), "Description required");
        assert!(!documents_hash.is_empty(), "Documents hash required");
        assert!(amount.0 > 0, "Amount must be greater than 0");
        assert!(
            due_date > env::block_timestamp_ms(),
            "Due date must be in the future"
        );

        // Calculate risk score based on amount and due date
        let days_until_due =
            (due_date.saturating_sub(env::block_timestamp_ms())) / (24 * 60 * 60 * 1000);
        let amount_val = amount.0;

        let risk_score = if amount_val < 1_000_000_000 && days_until_due < 30 {
            // Small amount, short term = low risk
            20 + (env::block_timestamp() % 10) as u8
        } else if amount_val < 5_000_000_000 && days_until_due < 60 {
            // Medium amount, medium term = medium risk
            40 + (env::block_timestamp() % 15) as u8
        } else if amount_val < 10_000_000_000 && days_until_due < 90 {
            // Larger amount, longer term = higher risk
            55 + (env::block_timestamp() % 15) as u8
        } else {
            // Large amount or long term = highest risk
            70 + (env::block_timestamp() % 20) as u8
        };

        let invoice = Invoice {
            id: id.clone(),
            creator: creator.clone(),
            owner: creator.clone(),
            amount,
            currency: "USDC".to_string(),
            debtor_name,
            debtor_email,
            description,
            due_date,
            created_at: env::block_timestamp_ms(),
            documents_hash,
            status: InvoiceStatus::Draft,
            risk_score: risk_score.min(99),
        };

        self.invoices.insert(id.clone(), invoice);

        // Update creator index
        let mut creator_invoices = self
            .invoices_by_creator
            .get(&creator)
            .cloned()
            .unwrap_or_default();
        creator_invoices.push(id.clone());
        self.invoices_by_creator
            .insert(creator.clone(), creator_invoices);

        // Update owner index
        let mut owner_invoices = self
            .invoices_by_owner
            .get(&creator)
            .cloned()
            .unwrap_or_default();
        owner_invoices.push(id.clone());
        self.invoices_by_owner.insert(creator, owner_invoices);

        env::log_str(&format!("Invoice created: {}", id));
        id
    }

    /// Transfer invoice ownership (called by marketplace during sale)
    pub fn transfer_invoice(&mut self, invoice_id: String, new_owner: AccountId) {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.marketplace_contract,
            "Only marketplace can transfer invoices"
        );

        let mut invoice = self
            .invoices
            .get(&invoice_id)
            .expect("Invoice not found")
            .clone();
        assert!(
            invoice.status == InvoiceStatus::Listed,
            "Invoice must be listed"
        );

        let old_owner = invoice.owner.clone();

        // Update owner
        invoice.owner = new_owner.clone();
        invoice.status = InvoiceStatus::Sold;
        self.invoices.insert(invoice_id.clone(), invoice);

        // Update owner indexes
        if let Some(mut old_owner_invoices) = self.invoices_by_owner.get(&old_owner).cloned() {
            old_owner_invoices.retain(|id| id != &invoice_id);
            self.invoices_by_owner.insert(old_owner, old_owner_invoices);
        }

        let mut new_owner_invoices = self
            .invoices_by_owner
            .get(&new_owner)
            .cloned()
            .unwrap_or_default();
        new_owner_invoices.push(invoice_id.clone());
        self.invoices_by_owner.insert(new_owner.clone(), new_owner_invoices);

        env::log_str(&format!(
            "Invoice {} transferred to {}",
            invoice_id, new_owner
        ));
    }

    /// Mark invoice as settled
    pub fn mark_settled(&mut self, invoice_id: String) {
        let caller = env::predecessor_account_id();
        assert!(
            caller == self.escrow_contract || caller == self.marketplace_contract,
            "Unauthorized"
        );

        let mut invoice = self
            .invoices
            .get(&invoice_id)
            .expect("Invoice not found")
            .clone();
        assert!(
            invoice.status == InvoiceStatus::Sold,
            "Invoice must be sold to settle"
        );

        invoice.status = InvoiceStatus::Settled;
        self.invoices.insert(invoice_id.clone(), invoice);

        env::log_str(&format!("Invoice {} settled", invoice_id));
    }

    /// Update invoice status to Listed
    pub fn set_listed(&mut self, invoice_id: String) {
        let caller = env::predecessor_account_id();
        let mut invoice = self
            .invoices
            .get(&invoice_id)
            .expect("Invoice not found")
            .clone();

        // Allow marketplace or owner to set listed
        assert!(
            invoice.owner == caller || caller == self.marketplace_contract,
            "Only owner or marketplace can list invoice"
        );
        assert!(
            invoice.status == InvoiceStatus::Draft,
            "Invoice must be in Draft status"
        );

        invoice.status = InvoiceStatus::Listed;
        self.invoices.insert(invoice_id.clone(), invoice);

        env::log_str(&format!("Invoice {} listed", invoice_id));
    }

    /// Cancel an invoice (only draft invoices)
    pub fn cancel_invoice(&mut self, invoice_id: String) {
        let caller = env::predecessor_account_id();
        let mut invoice = self
            .invoices
            .get(&invoice_id)
            .expect("Invoice not found")
            .clone();

        assert!(invoice.owner == caller, "Only owner can cancel invoice");
        assert!(
            invoice.status == InvoiceStatus::Draft,
            "Can only cancel draft invoices"
        );

        invoice.status = InvoiceStatus::Cancelled;
        self.invoices.insert(invoice_id.clone(), invoice);

        env::log_str(&format!("Invoice {} cancelled", invoice_id));
    }

    /// Unlist an invoice (revert to draft)
    pub fn unlist_invoice(&mut self, invoice_id: String) {
        let caller = env::predecessor_account_id();
        let mut invoice = self
            .invoices
            .get(&invoice_id)
            .expect("Invoice not found")
            .clone();

        assert!(
            invoice.owner == caller || caller == self.marketplace_contract,
            "Unauthorized"
        );
        assert!(
            invoice.status == InvoiceStatus::Listed,
            "Invoice must be listed"
        );

        invoice.status = InvoiceStatus::Draft;
        self.invoices.insert(invoice_id.clone(), invoice);

        env::log_str(&format!("Invoice {} unlisted", invoice_id));
    }

    /// Update marketplace contract (admin only - for setup)
    pub fn set_marketplace_contract(&mut self, marketplace_contract: AccountId) {
        // In production, add proper admin check
        self.marketplace_contract = marketplace_contract;
    }

    /// Update escrow contract (admin only - for setup)
    pub fn set_escrow_contract(&mut self, escrow_contract: AccountId) {
        // In production, add proper admin check
        self.escrow_contract = escrow_contract;
    }

    // ============ VIEW METHODS ============

    /// Get single invoice by ID
    pub fn get_invoice(&self, invoice_id: String) -> Option<Invoice> {
        self.invoices.get(&invoice_id).cloned()
    }

    /// Get all invoices created by an account
    pub fn get_invoices_by_creator(&self, account_id: AccountId) -> Vec<Invoice> {
        self.invoices_by_creator
            .get(&account_id)
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|id| self.invoices.get(id).cloned())
            .collect()
    }

    /// Get all invoices owned by an account
    pub fn get_invoices_by_owner(&self, account_id: AccountId) -> Vec<Invoice> {
        self.invoices_by_owner
            .get(&account_id)
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|id| self.invoices.get(id).cloned())
            .collect()
    }

    /// Get all invoices (paginated)
    pub fn get_all_invoices(&self, from_index: u64, limit: u64) -> Vec<Invoice> {
        self.invoices
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(_, invoice)| invoice.clone())
            .collect()
    }

    /// Get invoices by status
    pub fn get_invoices_by_status(&self, status: InvoiceStatus) -> Vec<Invoice> {
        self.invoices
            .iter()
            .filter(|(_, invoice)| invoice.status == status)
            .map(|(_, invoice)| invoice.clone())
            .collect()
    }

    /// Get total invoice count
    pub fn get_invoice_count(&self) -> u64 {
        self.invoice_count
    }

    /// Get marketplace contract address
    pub fn get_marketplace_contract(&self) -> AccountId {
        self.marketplace_contract.clone()
    }

    /// Get escrow contract address
    pub fn get_escrow_contract(&self) -> AccountId {
        self.escrow_contract.clone()
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
    fn test_create_invoice() {
        let marketplace: AccountId = "marketplace.testnet".parse().unwrap();
        let escrow: AccountId = "escrow.testnet".parse().unwrap();
        let alice: AccountId = "alice.testnet".parse().unwrap();

        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut contract = InvoiceContract::new(marketplace, escrow);

        let invoice_id = contract.create_invoice(
            U128(2_000_000_000), // $2000 USDC
            "Acme Corp".to_string(),
            Some("billing@acme.com".to_string()),
            "500 widgets".to_string(),
            env::block_timestamp_ms() + 30 * 24 * 60 * 60 * 1000, // 30 days
            "QmXYZ123".to_string(),
        );

        assert_eq!(invoice_id, "INV-000001");

        let invoice = contract.get_invoice(invoice_id).unwrap();
        assert_eq!(invoice.creator, alice);
        assert_eq!(invoice.owner, alice);
        assert_eq!(invoice.amount.0, 2_000_000_000);
        assert_eq!(invoice.status, InvoiceStatus::Draft);
    }

    #[test]
    fn test_list_invoice() {
        let marketplace: AccountId = "marketplace.testnet".parse().unwrap();
        let escrow: AccountId = "escrow.testnet".parse().unwrap();
        let alice: AccountId = "alice.testnet".parse().unwrap();

        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut contract = InvoiceContract::new(marketplace, escrow);

        let invoice_id = contract.create_invoice(
            U128(1_000_000_000),
            "Test Corp".to_string(),
            None,
            "Test invoice".to_string(),
            env::block_timestamp_ms() + 30 * 24 * 60 * 60 * 1000,
            "QmTest".to_string(),
        );

        contract.set_listed(invoice_id.clone());

        let invoice = contract.get_invoice(invoice_id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Listed);
    }
}
