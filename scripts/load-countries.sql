-- Load Gelato-supported countries for print-on-demand
-- Based on Gelato's official shipping regions and local production network
-- All countries are initially set to inactive (is_supported = false)
-- Admins can enable specific countries through the /admin/countries interface
-- Source: Gelato ships to 200+ countries with local production in 32 countries

-- Clear existing data first (optional - comment out if you want to preserve existing settings)
-- DELETE FROM public.countries;

-- Insert Gelato-supported countries organized by shipping regions
INSERT INTO public.countries (code, name, currency_code, currency_symbol, is_supported, shipping_zone, tax_rate_percent, display_order) VALUES

-- === GELATO PRIMARY REGIONS (Local Production) ===

-- USA Region
('US', 'United States', 'USD', '$', false, 'usa', 0.0, 10),

-- UK/Ireland Region  
('GB', 'United Kingdom', 'GBP', '£', false, 'uk_ireland', 20.0, 20),
('IE', 'Ireland', 'EUR', '€', false, 'uk_ireland', 23.0, 30),

-- Germany Region (Major EU Hub)
('DE', 'Germany', 'EUR', '€', false, 'germany', 19.0, 40),

-- Canada Region
('CA', 'Canada', 'CAD', 'C$', false, 'canada', 13.0, 50),

-- Australia/New Zealand Region
('AU', 'Australia', 'AUD', 'A$', false, 'australia_nz', 10.0, 60),
('NZ', 'New Zealand', 'NZD', 'NZ$', false, 'australia_nz', 15.0, 70),

-- Japan Region
('JP', 'Japan', 'JPY', '¥', false, 'japan', 10.0, 80),

-- Singapore Region (Asia Hub)
('SG', 'Singapore', 'SGD', 'S$', false, 'singapore', 7.0, 90),

-- Brazil Region
('BR', 'Brazil', 'BRL', 'R$', false, 'brazil', 17.0, 100),

-- Scandinavia Region
('DK', 'Denmark', 'DKK', 'kr.', false, 'scandinavia', 25.0, 110),
('NO', 'Norway', 'NOK', 'kr', false, 'scandinavia', 25.0, 120),
('SE', 'Sweden', 'SEK', 'kr', false, 'scandinavia', 25.0, 130),

-- === EUROPE REGION (28 countries with EU production) ===

-- Major EU Markets
('FR', 'France', 'EUR', '€', false, 'europe', 20.0, 140),
('ES', 'Spain', 'EUR', '€', false, 'europe', 21.0, 150),
('IT', 'Italy', 'EUR', '€', false, 'europe', 22.0, 160),
('NL', 'Netherlands', 'EUR', '€', false, 'europe', 21.0, 170),
('BE', 'Belgium', 'EUR', '€', false, 'europe', 21.0, 180),
('AT', 'Austria', 'EUR', '€', false, 'europe', 20.0, 190),
('PT', 'Portugal', 'EUR', '€', false, 'europe', 23.0, 200),

-- Eastern Europe EU
('PL', 'Poland', 'PLN', 'zł', false, 'europe', 23.0, 210),
('CZ', 'Czech Republic', 'CZK', 'Kč', false, 'europe', 21.0, 220),
('HU', 'Hungary', 'HUF', 'Ft', false, 'europe', 27.0, 230),
('RO', 'Romania', 'RON', 'lei', false, 'europe', 19.0, 240),
('BG', 'Bulgaria', 'BGN', 'лв', false, 'europe', 20.0, 250),
('HR', 'Croatia', 'EUR', '€', false, 'europe', 25.0, 260),
('SK', 'Slovakia', 'EUR', '€', false, 'europe', 20.0, 270),
('SI', 'Slovenia', 'EUR', '€', false, 'europe', 22.0, 280),

-- Baltic States
('EE', 'Estonia', 'EUR', '€', false, 'europe', 20.0, 290),
('LV', 'Latvia', 'EUR', '€', false, 'europe', 21.0, 300),
('LT', 'Lithuania', 'EUR', '€', false, 'europe', 21.0, 310),

-- Mediterranean EU
('GR', 'Greece', 'EUR', '€', false, 'europe', 24.0, 320),
('CY', 'Cyprus', 'EUR', '€', false, 'europe', 19.0, 330),
('MT', 'Malta', 'EUR', '€', false, 'europe', 18.0, 340),
('LU', 'Luxembourg', 'EUR', '€', false, 'europe', 17.0, 350),
('FI', 'Finland', 'EUR', '€', false, 'europe', 24.0, 360),

-- Special European Territories (Gelato-supported)
('AX', 'Åland Islands', 'EUR', '€', false, 'europe', 24.0, 370),
('FO', 'Faroe Islands', 'DKK', 'kr.', false, 'europe', 25.0, 380),
('GI', 'Gibraltar', 'GBP', '£', false, 'europe', 0.0, 390),
('GL', 'Greenland', 'DKK', 'kr.', false, 'europe', 0.0, 400),
('GG', 'Guernsey', 'GBP', '£', false, 'europe', 0.0, 410),
('JE', 'Jersey', 'GBP', '£', false, 'europe', 5.0, 420),

-- Small European States
('AD', 'Andorra', 'EUR', '€', false, 'europe', 4.5, 430),
('SM', 'San Marino', 'EUR', '€', false, 'europe', 17.0, 440),
('VA', 'Vatican City', 'EUR', '€', false, 'europe', 0.0, 450),
('AL', 'Albania', 'ALL', 'L', false, 'europe', 20.0, 460),

-- === EFTA STATES (European Free Trade Association) ===
('CH', 'Switzerland', 'CHF', 'CHF', false, 'efta', 7.7, 470),
('IS', 'Iceland', 'ISK', 'kr', false, 'efta', 24.0, 480),
('LI', 'Liechtenstein', 'CHF', 'CHF', false, 'efta', 7.7, 490),

-- === WORLDWIDE SHIPPING (Major Markets) ===

-- Asia-Pacific (Beyond Japan/Singapore)
('KR', 'South Korea', 'KRW', '₩', false, 'worldwide', 10.0, 500),
('HK', 'Hong Kong', 'HKD', 'HK$', false, 'worldwide', 0.0, 510),
('TW', 'Taiwan', 'TWD', 'NT$', false, 'worldwide', 5.0, 520),
('MY', 'Malaysia', 'MYR', 'RM', false, 'worldwide', 10.0, 530),
('TH', 'Thailand', 'THB', '฿', false, 'worldwide', 7.0, 540),
('PH', 'Philippines', 'PHP', '₱', false, 'worldwide', 12.0, 550),
('ID', 'Indonesia', 'IDR', 'Rp', false, 'worldwide', 11.0, 560),
('VN', 'Vietnam', 'VND', '₫', false, 'worldwide', 10.0, 570),
('IN', 'India', 'INR', '₹', false, 'worldwide', 18.0, 580),
('CN', 'China', 'CNY', '¥', false, 'worldwide', 13.0, 590),

-- Latin America (Beyond Brazil)
('MX', 'Mexico', 'MXN', '$', false, 'worldwide', 16.0, 600),
('AR', 'Argentina', 'ARS', '$', false, 'worldwide', 21.0, 610),
('CL', 'Chile', 'CLP', '$', false, 'worldwide', 19.0, 620),
('CO', 'Colombia', 'COP', '$', false, 'worldwide', 19.0, 630),
('PE', 'Peru', 'PEN', 'S/', false, 'worldwide', 18.0, 640),
('EC', 'Ecuador', 'USD', '$', false, 'worldwide', 12.0, 650),
('UY', 'Uruguay', 'UYU', '$U', false, 'worldwide', 22.0, 660),

-- Middle East & Africa  
('AE', 'United Arab Emirates', 'AED', 'د.إ', false, 'worldwide', 5.0, 670),
('SA', 'Saudi Arabia', 'SAR', 'ر.س', false, 'worldwide', 15.0, 680),
('IL', 'Israel', 'ILS', '₪', false, 'worldwide', 17.0, 690),
('TR', 'Turkey', 'TRY', '₺', false, 'worldwide', 18.0, 700),
('EG', 'Egypt', 'EGP', 'ج.م', false, 'worldwide', 14.0, 710),
('ZA', 'South Africa', 'ZAR', 'R', false, 'worldwide', 15.0, 720),
('MA', 'Morocco', 'MAD', 'د.م.', false, 'worldwide', 20.0, 730),
('KE', 'Kenya', 'KES', 'KSh', false, 'worldwide', 16.0, 740),
('NG', 'Nigeria', 'NGN', '₦', false, 'worldwide', 7.5, 750),

-- Additional Key Markets
('RU', 'Russia', 'RUB', '₽', false, 'worldwide', 20.0, 760),
('UA', 'Ukraine', 'UAH', '₴', false, 'worldwide', 20.0, 770)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  currency_symbol = EXCLUDED.currency_symbol,
  shipping_zone = EXCLUDED.shipping_zone,
  tax_rate_percent = EXCLUDED.tax_rate_percent,
  display_order = EXCLUDED.display_order
-- Note: is_supported is NOT updated to preserve existing admin choices
;

-- Create or update indexes
CREATE INDEX IF NOT EXISTS idx_countries_is_supported ON public.countries(is_supported);
CREATE INDEX IF NOT EXISTS idx_countries_display_order ON public.countries(display_order);
CREATE INDEX IF NOT EXISTS idx_countries_shipping_zone ON public.countries(shipping_zone);

-- Show summary
DO $$
DECLARE
    total_count INTEGER;
    active_count INTEGER;
    regions_summary TEXT;
BEGIN
    SELECT COUNT(*) INTO total_count FROM public.countries;
    SELECT COUNT(*) INTO active_count FROM public.countries WHERE is_supported = true;
    
    SELECT string_agg(
        shipping_zone || ': ' || COUNT(*)::TEXT, 
        ', ' ORDER BY shipping_zone
    ) INTO regions_summary 
    FROM public.countries 
    GROUP BY shipping_zone;
    
    RAISE NOTICE '🌍 Gelato Countries Loaded Successfully!';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE 'Total countries: %', total_count;
    RAISE NOTICE 'Active countries: %', active_count;
    RAISE NOTICE 'Inactive countries: %', (total_count - active_count);
    RAISE NOTICE '';
    RAISE NOTICE 'Countries by shipping zone: %', regions_summary;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '1. Visit /admin/countries to enable countries for Gelato pricing';
    RAISE NOTICE '2. Countries are organized by Gelato shipping zones';
    RAISE NOTICE '3. Primary regions have local production facilities';
    RAISE NOTICE '4. All countries support worldwide shipping via Gelato';
END $$;