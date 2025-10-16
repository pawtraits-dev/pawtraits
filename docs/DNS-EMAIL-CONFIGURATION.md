# DNS, Email, and Web Hosting Configuration Guide

## Overview

This guide configures DNS for:
- **Web Hosting**: Vercel (pawtraits.pics production, pawtraits.dev development/staging)
- **App Emails**: Resend (transactional emails from the application)
- **Business Emails**: cPanel (regular email like info@pawtraits.dev, support@pawtraits.pics)

## Problem Statement

After switching web hosting to Vercel, emails to pawtraits.dev stopped working. This happens because DNS records need to be configured to:
1. Point web traffic to Vercel
2. Point email traffic to cPanel mail servers
3. Allow Resend to send emails on behalf of your domain

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DNS Configuration                         │
│                  (Managed in Domain Registrar)               │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│   A/CNAME   │    │  MX Records │   │ SPF/DKIM    │
│  Records    │    │             │   │  Records    │
└──────┬──────┘    └──────┬──────┘   └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│   Vercel    │    │   cPanel    │   │   Resend    │
│ Web Hosting │    │ Email Host  │   │ App Emails  │
└─────────────┘    └─────────────┘   └─────────────┘
```

## Part 1: Understanding DNS Record Types

### A Records
- Maps domain to IP address
- Example: `pawtraits.dev → 76.76.21.21` (Vercel IP)

### CNAME Records
- Maps subdomain to another domain
- Example: `www.pawtraits.dev → cname.vercel-dns.com`

### MX Records (Mail Exchange)
- Tells email where to deliver messages
- Example: `pawtraits.dev → mail.yourhost.com` (cPanel server)

### TXT Records
- Stores text information for verification
- Used for: SPF, DKIM, DMARC, domain verification

## Part 2: cPanel Email Server Discovery

### Step 1: Find Your cPanel Mail Server

**Option A: Check cPanel Email Settings**
1. Log into your cPanel account
2. Go to **Email Accounts**
3. Click **Configure Email Client** for any email account
4. Look for **Incoming Mail Server** - this is your MX server
   - Example: `mail.yourhostingprovider.com`
   - Or: `mx1.yourhostingprovider.com`

**Option B: Check Current MX Records**
1. Use online DNS lookup tool: https://mxtoolbox.com/SuperTool.aspx
2. Enter: `pawtraits.dev`
3. Select **MX Lookup**
4. Note down all MX records and their priorities

**Option C: Contact Hosting Provider**
- If you can't find it, contact your cPanel hosting provider
- Ask for: "MX records and mail server hostname for receiving email"

### Step 2: Document Your Email Settings

Fill this in (you'll need it later):
```
Current Email Host: ____________________
MX Server 1: ____________________ (Priority: 10)
MX Server 2: ____________________ (Priority: 20) [if applicable]
SMTP Server: ____________________
IMAP Server: ____________________
```

## Part 3: Vercel Domain Configuration

### For pawtraits.pics (Production Domain)

#### Step 1: Add Domain in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Pawtraits project
3. Go to **Settings → Domains**
4. Click **Add Domain**
5. Enter: `pawtraits.pics`
6. Click **Add**

#### Step 2: Add www Subdomain
1. Click **Add Domain** again
2. Enter: `www.pawtraits.pics`
3. Vercel will suggest redirecting www → non-www (recommended)

#### Step 3: Note Vercel DNS Instructions
Vercel will show you DNS records to add. **Do NOT add these yet** - we'll do all DNS changes together in Part 5.

You'll see something like:
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### For pawtraits.dev (Development/Staging Domain)

Repeat the same process for `pawtraits.dev` if you want it hosted on Vercel.

## Part 4: Resend Configuration

Resend allows your application to send transactional emails (order confirmations, password resets, etc.)

### Step 1: Create Resend Account
1. Go to https://resend.com
2. Sign up or log in
3. Verify your account

### Step 2: Add Domain to Resend

**For pawtraits.pics:**
1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter: `pawtraits.pics`
4. Choose **Send emails from**: `noreply@pawtraits.pics` (or `hello@`, `notifications@`, etc.)

**Important**: Use a subdomain or specific address for app emails, NOT your main business email address.

### Step 3: Get Resend DNS Records
Resend will provide DNS records for domain verification and email authentication:

1. **DKIM Records** (2-3 TXT records):
   - Used to sign emails and prove they're from you
   - Example:
     ```
     Type: TXT
     Name: resend._domainkey
     Value: p=MIGfMA0GCSqGSIb3DQEBA... (long key)
     ```

2. **SPF Record** (TXT record):
   - Lists servers allowed to send email for your domain
   - Will be combined with cPanel's SPF

**Do NOT add these yet** - we'll combine them properly in Part 5.

### Step 4: Note Resend Settings
Document these for later:
```
Resend Domain: pawtraits.pics
Resend API Key: re_______________ (from Resend dashboard)
From Address: noreply@pawtraits.pics
```

## Part 5: DNS Configuration (The Critical Part)

**⚠️ IMPORTANT**: Make ALL DNS changes together to avoid downtime.

### Where to Make DNS Changes

Your DNS is managed by your **domain registrar** (where you bought the domain) OR your hosting provider if you transferred DNS management.

Common registrars:
- GoDaddy
- Namecheap
- Google Domains (now Squarespace)
- Cloudflare
- Hover

**Find your registrar:**
1. Go to https://lookup.icann.org/
2. Enter: `pawtraits.pics`
3. Look for **Registrar** field

### DNS Records to Add/Update

I'll show you the complete DNS configuration. You'll need to:
- **Keep** existing MX records (cPanel email)
- **Update** A/CNAME records (Vercel web)
- **Add** DKIM records (Resend)
- **Update** SPF record (combine cPanel + Resend)

#### For pawtraits.pics:

| Type | Name/Host | Value | Priority | TTL | Purpose |
|------|-----------|-------|----------|-----|---------|
| **A** | `@` | `76.76.21.21` (from Vercel) | - | 3600 | Root domain → Vercel |
| **CNAME** | `www` | `cname.vercel-dns.com` | - | 3600 | www → Vercel |
| **CNAME** | `staging` | `cname.vercel-dns.com` | - | 3600 | Staging environment |
| **MX** | `@` | `mail.yourhost.com` | 10 | 3600 | Primary email server |
| **MX** | `@` | `mail2.yourhost.com` | 20 | 3600 | Backup email (if exists) |
| **TXT** | `@` | `v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all` | - | 3600 | SPF (see below) |
| **TXT** | `resend._domainkey` | `[DKIM key from Resend]` | - | 3600 | Resend DKIM |
| **TXT** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@pawtraits.pics` | - | 3600 | DMARC policy |

#### For pawtraits.dev:

Same structure, but use your actual cPanel mail server values.

### SPF Record Explained

The SPF record tells email providers which servers can send email for your domain. You need to **combine** authorizations:

**Bad (only allows one sender):**
```
v=spf1 include:resend.com ~all  ❌ Blocks cPanel
```

**Good (allows both):**
```
v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all  ✅
```

**To find your cPanel's SPF include:**
1. Check your current SPF record: https://mxtoolbox.com/spf.aspx
2. Enter: `pawtraits.dev`
3. Look for existing `include:` statements
4. Common ones:
   - `include:_spf.mx.cloudflare.net` (Cloudflare email)
   - `include:mx.yourhostingprovider.com`
   - `a:mail.yourhostingprovider.com`

**Build your SPF record:**
```
v=spf1 [your cPanel include] include:resend.com ~all
```

Example:
```
v=spf1 include:_spf.hosting.com include:resend.com ~all
```

### DKIM Records from Resend

Add **exactly as shown** in Resend dashboard:
```
Type: TXT
Name: resend._domainkey
Value: [long cryptographic key from Resend]
```

Some registrars automatically add the domain, so you might need:
- Just: `resend._domainkey`
- Or: `resend._domainkey.pawtraits.pics.` (with trailing dot)

### DMARC Record

Protects your domain from spoofing:
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@pawtraits.pics
```

This sends reports but doesn't block anything (`p=none`). Later, you can change to `p=quarantine` or `p=reject`.

## Part 6: Step-by-Step Implementation

### Phase 1: Preparation (Before Making Changes)

**1. Document Current DNS Settings**
```bash
# Check current DNS
nslookup pawtraits.dev
nslookup pawtraits.pics

# Check current MX records
nslookup -type=mx pawtraits.dev
nslookup -type=mx pawtraits.pics

# Check current SPF
nslookup -type=txt pawtraits.dev
nslookup -type=txt pawtraits.pics
```

**2. Backup Current Configuration**
- Take screenshots of ALL current DNS records
- Export DNS records if your registrar allows it
- Save to a safe location

**3. Gather All Required Information**
- [ ] Vercel DNS records (from Vercel dashboard)
- [ ] cPanel MX server hostnames
- [ ] cPanel SPF include statement
- [ ] Resend DKIM keys (from Resend dashboard)
- [ ] Access to domain registrar DNS management

### Phase 2: Update DNS Records

**⚠️ TIMING**: DNS changes can take 4-48 hours to propagate. Make all changes at once, ideally during low-traffic hours.

**1. Log into Domain Registrar**
- Go to your domain registrar's website
- Navigate to DNS Management / DNS Settings
- Find pawtraits.pics and pawtraits.dev

**2. Update Web Hosting Records (Vercel)**

**Delete these if they exist:**
- Old A records pointing to previous hosting
- Old CNAME records for www

**Add these:**
```
Type: A
Name: @ (or leave blank for root domain)
Value: 76.76.21.21 (or the IP Vercel gave you)
TTL: 3600 (or Auto)

Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

**3. Verify/Update Email Records (cPanel)**

**Check if these exist - DO NOT DELETE:**
```
Type: MX
Name: @ (root domain)
Value: mail.yourhost.com
Priority: 10
TTL: 3600
```

**If missing, add them using the values you found in Part 2.**

**4. Add Resend DKIM Records**

**Add new TXT record:**
```
Type: TXT
Name: resend._domainkey
Value: [paste exact value from Resend dashboard]
TTL: 3600
```

**5. Update SPF Record**

**Find existing TXT record** that starts with `v=spf1`

**Replace it with:**
```
Type: TXT
Name: @ (root domain)
Value: v=spf1 [your-cpanel-include] include:resend.com ~all
TTL: 3600
```

Example:
```
v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all
```

**⚠️ CRITICAL**: If you have multiple SPF records, combine them into ONE record. Multiple SPF records will break email delivery.

**6. Add DMARC Record**

**Add new TXT record:**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@pawtraits.pics
TTL: 3600
```

### Phase 3: Verification

**Wait 1-4 hours for DNS propagation, then verify:**

**1. Check Web Hosting**
```bash
# Should show Vercel IP
nslookup pawtraits.pics

# Should show Vercel CNAME
nslookup www.pawtraits.pics
```

Or visit:
- https://pawtraits.pics (should show Vercel-hosted site)
- https://www.pawtraits.pics (should redirect or show site)

**2. Check MX Records**
```bash
nslookup -type=mx pawtraits.pics
```

Should show your cPanel mail server, NOT Vercel.

Or use: https://mxtoolbox.com/mx/pawtraits.pics

**3. Verify Resend Domain**
1. Go to Resend dashboard → Domains
2. Your domain should show **Verified** ✅
3. If not, click **Verify** and wait (can take up to 24 hours)

**4. Test Email Delivery**

**Test receiving email (cPanel):**
1. Send an email to: `test@pawtraits.pics` (or any email you created in cPanel)
2. Check if it arrives in your cPanel email inbox
3. If not working, check MX records again

**Test sending email (Resend):**
1. Go to Resend dashboard → API Keys
2. Create a test API key
3. Use Resend's test tool to send an email from `noreply@pawtraits.pics`
4. Check if it arrives in your inbox
5. Check spam folder if not in inbox

**5. Check SPF/DKIM/DMARC**
Use these tools:
- https://mxtoolbox.com/SuperTool.aspx
- https://dmarcian.com/domain-checker/

Enter your domain and verify:
- ✅ SPF record exists and includes both cPanel and Resend
- ✅ DKIM record exists for Resend
- ✅ DMARC record exists

## Part 7: Application Configuration

### Update Environment Variables in Vercel

**1. Go to Vercel Dashboard → Settings → Environment Variables**

**2. Add Resend API Key (All Environments)**
```
Name: RESEND_API_KEY
Value: re_your_api_key_from_resend_dashboard
Environments: ✅ Production ✅ Preview ✅ Development
Type: Secret (encrypted)
```

**3. Add Email From Address**
```
Name: RESEND_FROM_EMAIL
Value: noreply@pawtraits.pics
Environments: ✅ Production ✅ Preview ✅ Development
```

**4. Add Support/Reply-To Email**
```
Name: SUPPORT_EMAIL
Value: support@pawtraits.pics
Environments: ✅ Production ✅ Preview ✅ Development
```

### Update Supabase Email Settings (Optional)

If using Supabase Auth for user authentication:

**1. Go to Supabase Dashboard → Authentication → Email Templates**

**2. Update SMTP Settings**
- Option A: Use Resend SMTP
  - SMTP Host: `smtp.resend.com`
  - Port: 465 or 587
  - Username: `resend`
  - Password: Your Resend API Key

- Option B: Keep Supabase's built-in email (easier)

**3. Update From Email**
- Change from: `auth@pawtraits.pics` or `noreply@pawtraits.pics`

## Part 8: Troubleshooting

### Issue: Website Not Loading (502/504 Errors)

**Cause**: DNS not pointing to Vercel correctly

**Fix:**
1. Verify A record points to Vercel IP: `nslookup pawtraits.pics`
2. Check Vercel dashboard → Domains shows "Valid Configuration"
3. Wait for DNS propagation (up to 48 hours)
4. Try accessing via Vercel preview URL to confirm app works

### Issue: Can't Receive Email

**Cause**: MX records missing or pointing to wrong server

**Fix:**
1. Check MX records: https://mxtoolbox.com/mx/pawtraits.pics
2. Verify MX records point to your cPanel server, NOT Vercel
3. Contact hosting provider to confirm correct MX values
4. Wait for DNS propagation

### Issue: Can Receive Email But Not Send

**Cause**: SPF record issues or cPanel SMTP configuration

**Fix:**
1. Check SPF record: https://mxtoolbox.com/spf/pawtraits.pics
2. Verify cPanel SMTP settings in your email client
3. Ensure email client uses correct outgoing server (SMTP)
4. Check if hosting provider requires authenticated SMTP

### Issue: Resend Domain Not Verifying

**Cause**: DKIM records not added correctly

**Fix:**
1. Verify DKIM record exists: `nslookup -type=txt resend._domainkey.pawtraits.pics`
2. Check for typos in record name (some registrars auto-append domain)
3. Try these variations:
   - `resend._domainkey`
   - `resend._domainkey.pawtraits.pics`
   - `resend._domainkey.pawtraits.pics.` (with trailing dot)
4. Wait 24 hours for DNS propagation
5. Click "Verify" in Resend dashboard again

### Issue: Emails Going to Spam

**Cause**: Missing or incorrect SPF/DKIM/DMARC

**Fix:**
1. Verify all three exist: https://mxtoolbox.com/SuperTool.aspx
2. Test email authentication: https://www.mail-tester.com/
3. Ensure SPF includes both cPanel and Resend
4. Wait for DMARC reports (sent to `rua` email)
5. Consider warming up domain (send gradually increasing email volume)

### Issue: Multiple SPF Records Error

**Cause**: More than one SPF TXT record exists

**Fix:**
1. Find all SPF records in DNS settings
2. Combine them into ONE record:
   ```
   v=spf1 include:host1.com include:host2.com include:resend.com ~all
   ```
3. Delete duplicate SPF records
4. Keep only the combined one

### Issue: cPanel Email Settings Unknown

**Cause**: Don't have mail server information

**Fix:**
1. Log into cPanel
2. Go to Email Accounts
3. Click "Configure Email Client" for any account
4. Screenshot all settings
5. Or contact hosting provider support
6. Ask for: "MX records, SMTP server, IMAP server, and SPF include statement"

## Part 9: Testing Checklist

After DNS changes propagate (24-48 hours), test everything:

### Web Hosting (Vercel)
- [ ] `https://pawtraits.pics` loads correctly
- [ ] `https://www.pawtraits.pics` loads correctly
- [ ] `https://staging-pawtraits.vercel.app` loads correctly
- [ ] Environment indicator shows correct environment
- [ ] No SSL certificate errors

### Email Receiving (cPanel)
- [ ] Can receive email at existing email addresses
- [ ] Email client (Outlook/Gmail/Apple Mail) can connect
- [ ] No delay in email delivery (should be < 1 minute)
- [ ] Test with external email (Gmail, Outlook, etc.)

### Email Sending (Resend)
- [ ] Resend domain shows "Verified" in dashboard
- [ ] Can send test email from Resend dashboard
- [ ] Application can send emails (test order confirmation, etc.)
- [ ] Emails don't go to spam
- [ ] Reply-to address works correctly

### DNS Configuration
- [ ] A record points to Vercel: `nslookup pawtraits.pics`
- [ ] MX records point to cPanel: `nslookup -type=mx pawtraits.pics`
- [ ] SPF record includes both services: https://mxtoolbox.com/spf/pawtraits.pics
- [ ] DKIM record exists: `nslookup -type=txt resend._domainkey.pawtraits.pics`
- [ ] DMARC record exists: `nslookup -type=txt _dmarc.pawtraits.pics`

### Application Integration
- [ ] Vercel environment variables configured
- [ ] Test order confirmation email sends
- [ ] Test password reset email sends
- [ ] Test referral notification email sends
- [ ] From address shows as `noreply@pawtraits.pics`

## Part 10: Ongoing Maintenance

### Monthly Tasks
- [ ] Check DMARC reports (sent to `rua` email)
- [ ] Review Resend email logs for delivery issues
- [ ] Monitor email deliverability rates

### When Issues Arise
1. **Check DNS first**: Use mxtoolbox.com to verify records
2. **Check Resend dashboard**: Look for bounce/complaint rates
3. **Check Vercel logs**: Deployments tab for any issues
4. **Check cPanel email logs**: In cPanel → Email Deliverability

### Security Best Practices
- [ ] Rotate Resend API keys every 6 months
- [ ] Keep cPanel password strong and updated
- [ ] Monitor DMARC reports for spoofing attempts
- [ ] After 3 months of clean DMARC reports, change `p=none` to `p=quarantine`
- [ ] Enable 2FA on domain registrar, Vercel, Resend, and cPanel

## Quick Reference Card

### My Configuration

**Domain Registrar**: ___________________
**Vercel A Record**: 76.76.21.21
**cPanel MX Server**: ___________________
**cPanel SMTP Server**: ___________________
**Resend From Email**: noreply@pawtraits.pics
**Support Email**: support@pawtraits.pics

### Emergency Contacts

**Domain Registrar Support**: ___________________
**cPanel Hosting Support**: ___________________
**Vercel Support**: https://vercel.com/help
**Resend Support**: support@resend.com

### Useful Links

- Vercel Dashboard: https://vercel.com/dashboard
- Resend Dashboard: https://resend.com/overview
- cPanel: [Your cPanel URL]
- MX Toolbox: https://mxtoolbox.com/
- DNS Checker: https://dnschecker.org/

## Conclusion

This configuration allows:
- ✅ Web hosting on Vercel (fast, scalable)
- ✅ Regular email on cPanel (your existing setup)
- ✅ App transactional emails via Resend (reliable delivery)
- ✅ No conflicts between services
- ✅ Easy management of each component

If you run into issues, work through the troubleshooting section systematically, starting with DNS verification.
