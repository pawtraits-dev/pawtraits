# DNS & Email Quick Setup Checklist

Use this checklist alongside the full guide: `DNS-EMAIL-CONFIGURATION.md`

## 📋 Pre-Flight Checklist

### Information Gathering (Before Making Changes)

- [ ] **Find Domain Registrar**
  - Where did you buy pawtraits.pics and pawtraits.dev?
  - Login credentials working?

- [ ] **Get cPanel Email Info**
  - Log into cPanel
  - Go to Email Accounts → Configure Email Client
  - Note down:
    - Incoming Server (MX): `___________________`
    - Outgoing Server (SMTP): `___________________`
    - Current email addresses: `___________________`

- [ ] **Document Current DNS**
  - Visit: https://mxtoolbox.com/SuperTool.aspx
  - Check pawtraits.dev (the broken one)
  - Screenshot current A, MX, and TXT records
  - Note: What were MX records BEFORE switching to Vercel?

- [ ] **Get Vercel DNS Records**
  - Vercel Dashboard → Your Project → Settings → Domains
  - Add pawtraits.pics (if not already added)
  - Note the A record and CNAME values shown

- [ ] **Setup Resend Account**
  - Go to https://resend.com
  - Sign up / Log in
  - Go to Domains → Add Domain
  - Add: `pawtraits.pics`
  - Note the DKIM records (don't add yet)
  - Get API key: API Keys → Create API Key

## 🔧 DNS Configuration (Do All At Once)

### For pawtraits.pics (Production)

Log into your domain registrar's DNS management for `pawtraits.pics`:

#### 1. Web Hosting (Vercel)
- [ ] **A Record** for root domain
  ```
  Type: A
  Name: @ (or blank)
  Value: [IP from Vercel, likely 76.76.21.21]
  TTL: 3600
  ```

- [ ] **CNAME** for www
  ```
  Type: CNAME
  Name: www
  Value: cname.vercel-dns.com
  TTL: 3600
  ```

- [ ] **CNAME** for staging (optional)
  ```
  Type: CNAME
  Name: staging
  Value: cname.vercel-dns.com
  TTL: 3600
  ```

#### 2. Email Receiving (cPanel)
- [ ] **MX Records** (keep existing or add if missing)
  ```
  Type: MX
  Name: @ (or blank)
  Value: [your-cpanel-mail-server]
  Priority: 10
  TTL: 3600
  ```

  **⚠️ CRITICAL**: Do NOT change existing MX records unless you know they're wrong!

#### 3. Email Sending (SPF + Resend)
- [ ] **SPF Record** (combine cPanel + Resend)
  ```
  Type: TXT
  Name: @ (or blank)
  Value: v=spf1 [your-cpanel-include] include:resend.com ~all
  TTL: 3600
  ```

  **Example**:
  ```
  v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all
  ```

  **⚠️ Find your cPanel include**:
  - Check current SPF: https://mxtoolbox.com/spf/pawtraits.dev
  - Copy the `include:xxxxxxx` part
  - Add Resend's include to it

- [ ] **DKIM Record** (from Resend)
  ```
  Type: TXT
  Name: resend._domainkey
  Value: [long key from Resend dashboard]
  TTL: 3600
  ```

- [ ] **DMARC Record**
  ```
  Type: TXT
  Name: _dmarc
  Value: v=DMARC1; p=none; rua=mailto:dmarc@pawtraits.pics
  TTL: 3600
  ```

### For pawtraits.dev (Development)

Repeat the same steps above with pawtraits.dev

**⚠️ IMPORTANT**: Make sure pawtraits.dev has correct MX records pointing to your cPanel server!

## ⏱️ Wait for Propagation

- [ ] DNS changes made at: `_____ (date/time)`
- [ ] Wait 1-4 hours minimum
- [ ] Full propagation can take up to 48 hours

## ✅ Verification (After 2-4 Hours)

### Check Web Hosting
- [ ] Visit https://pawtraits.pics (should load from Vercel)
- [ ] Visit https://www.pawtraits.pics (should work)
- [ ] Check DNS: `nslookup pawtraits.pics` (should show Vercel IP)

### Check Email Receiving
- [ ] Send test email TO: `test@pawtraits.pics` or existing address
- [ ] Email arrives in cPanel inbox?
- [ ] Check MX: https://mxtoolbox.com/mx/pawtraits.pics
- [ ] MX points to cPanel server (NOT Vercel)?

### Check Email Sending (Resend)
- [ ] Resend Dashboard → Domains → pawtraits.pics shows "Verified" ✅
- [ ] Send test email from Resend dashboard
- [ ] Check spam folder if not in inbox

### Check DNS Records
- [ ] SPF: https://mxtoolbox.com/spf/pawtraits.pics ✅
- [ ] DKIM: `nslookup -type=txt resend._domainkey.pawtraits.pics` ✅
- [ ] DMARC: https://mxtoolbox.com/dmarc/pawtraits.pics ✅

## 🔌 Application Configuration

### Vercel Environment Variables
- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add these for ALL environments (Production, Preview, Development):

```env
RESEND_API_KEY=[from Resend dashboard]
RESEND_FROM_EMAIL=noreply@pawtraits.pics
SUPPORT_EMAIL=support@pawtraits.pics
```

### Redeploy Application
- [ ] Trigger a new deployment (push a commit or manual redeploy)
- [ ] Vercel needs to restart to pick up new env vars

## 🧪 Application Testing

- [ ] Test order confirmation email sends
- [ ] Test password reset email sends
- [ ] Check from address shows: `noreply@pawtraits.pics`
- [ ] Check reply-to goes to: `support@pawtraits.pics`
- [ ] Email doesn't go to spam

## 🚨 If Something's Wrong

### Website Not Loading
1. Check Vercel A record: `nslookup pawtraits.pics`
2. Check Vercel Dashboard → Domains (should show "Valid")
3. Wait longer (DNS can take 48 hours)
4. Try Vercel preview URL to confirm app works

### Can't Receive Email
1. Check MX records: https://mxtoolbox.com/mx/pawtraits.pics
2. MX should point to cPanel server, NOT Vercel
3. Contact hosting provider to confirm MX server hostname
4. Check if email works at other addresses (to isolate issue)

### Resend Not Verifying
1. Check DKIM: `nslookup -type=txt resend._domainkey.pawtraits.pics`
2. Try adding with trailing dot: `resend._domainkey.pawtraits.pics.`
3. Wait 24 hours and click "Verify" again
4. Contact Resend support if still failing

### Emails Going to Spam
1. Verify SPF includes both: https://mxtoolbox.com/spf/pawtraits.pics
2. Check DKIM and DMARC exist
3. Send test to: https://www.mail-tester.com/
4. Wait a few days (new domains have lower reputation)

## 📞 Support Contacts

**Before contacting support, have this ready:**
- Domain name: pawtraits.pics or pawtraits.dev
- Current DNS records (screenshots)
- Error messages (exact text)
- What you're trying to accomplish

**Who to contact:**
- **Web hosting issues**: Vercel support (https://vercel.com/help)
- **Email receiving issues**: Your cPanel hosting provider
- **Email sending issues**: Resend support (support@resend.com)
- **DNS issues**: Your domain registrar support

## 📝 Notes Section

Use this space to track your specific values:

```
Domain Registrar: ___________________
Registrar Login: ___________________

cPanel URL: ___________________
cPanel MX Server: ___________________
cPanel SMTP: ___________________

Resend API Key: re___________________
Resend From Email: noreply@pawtraits.pics

DNS Changes Made: _____/_____/_____ at _____:_____
Expected Propagation: _____/_____/_____

Issues Encountered:
-
-
-
```

---

## 🎯 Success Criteria

You're done when ALL of these work:

- ✅ pawtraits.pics loads your Vercel-hosted application
- ✅ Can receive email at your cPanel email addresses
- ✅ Can send email from application via Resend
- ✅ Resend domain shows "Verified"
- ✅ No SSL/TLS certificate errors
- ✅ Emails don't go to spam
- ✅ Environment indicator shows correct environment

**Estimated Total Time**: 2-4 hours (including DNS propagation wait)
