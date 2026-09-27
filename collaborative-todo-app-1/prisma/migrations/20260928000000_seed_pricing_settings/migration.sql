-- First-run seed (spec §Money): "Seed values: 100 ETB with placeholder
-- bank fields." The record is created by its migration so rendering the
-- admin settings form never writes to the database; the save action
-- upserts the same singleton if the row is ever missing.
INSERT INTO "PricingSettings" (
    "id",
    "price",
    "currency",
    "accountHolder",
    "accountNumber",
    "bankName",
    "transferInstructions",
    "updatedAt"
)
VALUES (
    'singleton',
    100,
    'ETB',
    'Placeholder Account Holder',
    '0123456789',
    'Placeholder Bank',
    'Transfer the exact amount to the account above and include your payment reference in the transfer memo.',
    CURRENT_TIMESTAMP
);
