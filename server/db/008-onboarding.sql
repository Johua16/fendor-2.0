ALTER TABLE users ADD COLUMN onboarding_intent text NOT NULL DEFAULT 'customer' CHECK (onboarding_intent IN ('customer','vendor'));
ALTER TABLE users ADD COLUMN date_of_birth date;
ALTER TABLE users ADD COLUMN phone_e164 text;
ALTER TABLE vendor_applications ADD COLUMN account_type text NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual','company'));

