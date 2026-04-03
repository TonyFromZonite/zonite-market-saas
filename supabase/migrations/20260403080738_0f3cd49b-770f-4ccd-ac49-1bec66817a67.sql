
-- Unique email index
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_email_unique ON sellers(email) WHERE email IS NOT NULL AND TRIM(email) != '';

-- Unique username index
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_username_unique ON sellers(username) WHERE username IS NOT NULL AND TRIM(username) != '';

-- Unique referral code index
CREATE UNIQUE INDEX IF NOT EXISTS idx_sellers_referral_code_unique ON sellers(code_parrainage) WHERE code_parrainage IS NOT NULL AND TRIM(code_parrainage) != '';

-- Fix SellerStatusEngine: ensure stuck vendors are active
UPDATE sellers SET seller_status = 'active_seller' WHERE seller_status IN ('kyc_required', 'pending_verification', 'email_verified');
