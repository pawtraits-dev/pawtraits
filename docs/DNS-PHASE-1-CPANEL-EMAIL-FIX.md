# Phase 1: Fix cPanel Email with Vercel Hosting

## Goal
Get email working again at pawtraits.dev while keeping web hosting on Vercel.

## The Problem
When you switched to Vercel, the DNS A record was changed to point to Vercel, which likely overwrote or conflicted with your MX records. Email stopped working because incoming mail didn't know where to go.

## The Solution
Configure DNS to:
1. Send **web traffic** (HTTP/HTTPS) → Vercel
2. Send **email traffic** (SMTP/IMAP) → cPanel mail server

## Your Mail Server Information
- **Mail Server**: `mail.pawtraits.pics`
- **Domain to Fix**: pawtraits.dev (currently broken)
- **Domain for Production**: pawtraits.pics (set up correctly later)

## DNS Records Needed

### For pawtraits.dev

You need these 4 types of records in your DNS:

#### 1. Web Hosting (Vercel) - A Record
```
Type: A
Name: @ (or leave blank for root domain)
Value: 76.76.21.21 (this is Vercel's IP - check your Vercel dashboard for exact IP)
TTL: 3600 (or Auto)
```

#### 2. Web Hosting (Vercel) - CNAME for www
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

#### 3. Email Hosting (cPanel) - MX Records
```
Type: MX
Name: @ (or leave blank for root domain)
Value: mail.pawtraits.pics
Priority: 10
TTL: 3600
```

**Note**: Some DNS providers require MX records to end with a dot:
```
Value: mail.pawtraits.pics.
```

#### 4. SPF Record (Email Authentication)
```
Type: TXT
Name: @ (or leave blank)
Value: v=spf1 a mx ~all
TTL: 3600
```

This SPF record says: "Allow mail servers listed in my A and MX records to send email for this domain."

## Step-by-Step Instructions

### Step 1: Find Your DNS Management Panel

Your DNS is managed by your domain registrar OR your hosting provider.

**Common locations:**
- If you bought domain from GoDaddy → GoDaddy DNS Management
- If you bought domain from Namecheap → Namecheap Advanced DNS
- If using Cloudflare → Cloudflare DNS
- If at your hosting provider → cPanel or hosting control panel

**To find your registrar:**
1. Go to https://lookup.icann.org/
2. Enter: `pawtraits.dev`
3. Look for **Registrar** field

### Step 2: Backup Current DNS Settings

**BEFORE making changes:**
1. Take screenshots of ALL current DNS records
2. Or export DNS records if your provider allows
3. Save these somewhere safe

### Step 3: Get Vercel's DNS Values

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Pawtraits project
3. Go to **Settings → Domains**
4. If pawtraits.dev isn't added yet:
   - Click **Add Domain**
   - Enter: `pawtraits.dev`
   - Vercel will show you the DNS records to add
5. Note down the **A record IP address** (likely `76.76.21.21`)

### Step 4: Update DNS Records

Log into your DNS management panel for pawtraits.dev.

#### A. Update/Add A Record (for web hosting)

**Look for existing A record with name "@" or blank:**
- If it exists and points to old hosting → **Update** the value to Vercel's IP
- If it doesn't exist → **Add** a new A record

```
Type: A
Name: @ (or blank or pawtraits.dev depending on your DNS provider)
Value: 76.76.21.21 (or the IP Vercel showed you)
TTL: 3600 or Auto
```

#### B. Update/Add CNAME for www

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

#### C. Check/Add MX Record (for email)

**This is critical - do NOT delete or change existing MX records unless they're wrong!**

**Look for MX records:**
- If you see: `mail.pawtraits.pics` with priority 10 → **Leave it alone!**
- If you see: `mail.pawtraits.dev` → That's also fine, leave it
- If you see Vercel-related MX records → **Delete** them (Vercel doesn't do email)
- If no MX records exist → **Add** the following:

```
Type: MX
Name: @ (or blank)
Value: mail.pawtraits.pics
Priority: 10
TTL: 3600
```

**Important**: Some DNS providers format MX records differently:
- Some want: `mail.pawtraits.pics`
- Some want: `mail.pawtraits.pics.` (with trailing dot)
- Some auto-append the domain, so you just enter: `mail`

If you're not sure, try the first format. If it doesn't work after propagation, try the others.

#### D. Check/Add SPF Record

**Look for existing TXT record that starts with `v=spf1`:**

- If it exists → Check if it includes `a mx` or references to your mail server
- If it's missing those → **Update** it to: `v=spf1 a mx ~all`
- If no SPF record exists → **Add** a new TXT record:

```
Type: TXT
Name: @ (or blank)
Value: v=spf1 a mx ~all
TTL: 3600
```

**⚠️ CRITICAL**: Only have ONE SPF record. If you have multiple TXT records starting with `v=spf1`, combine them into one or delete duplicates.

### Step 5: Verify Changes Were Saved

After adding/updating records:
1. Review all records in your DNS panel
2. Make sure everything is saved
3. Take a screenshot of the final configuration

**Your DNS should look like this:**

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| A | @ | 76.76.21.21 | - | 3600 |
| CNAME | www | cname.vercel-dns.com | - | 3600 |
| MX | @ | mail.pawtraits.pics | 10 | 3600 |
| TXT | @ | v=spf1 a mx ~all | - | 3600 |

### Step 6: Wait for DNS Propagation

DNS changes take time to spread across the internet:
- **Minimum wait**: 1-2 hours
- **Average wait**: 4-6 hours
- **Maximum wait**: 24-48 hours

**DO NOT PANIC** if things don't work immediately. DNS propagation is slow by design.

### Step 7: Test Web Hosting (After 1-2 Hours)

**Test if website is loading from Vercel:**

```bash
# Check DNS resolution
nslookup pawtraits.dev
```

Should show Vercel's IP (76.76.21.21 or similar).

**Or visit in browser:**
- Go to: https://pawtraits.dev
- Should load your Vercel-hosted application
- May take a few hours to see SSL certificate

### Step 8: Test Email (After 4-6 Hours)

**A. Check MX records are visible:**

```bash
nslookup -type=mx pawtraits.dev
```

Should show: `mail.pawtraits.pics` with priority 10

**Or use online tool:**
- Go to: https://mxtoolbox.com/mx/pawtraits.dev
- Should show your mail server, NOT Vercel

**B. Test receiving email:**

1. From your personal Gmail/Outlook, send a test email to: `your-email@pawtraits.dev`
2. Check if it arrives in your cPanel email inbox
3. May take 5-10 minutes for first email after DNS change

**C. Test sending email:**

1. Log into your email client (Outlook, Apple Mail, etc.) or cPanel webmail
2. Send an email from your pawtraits.dev address to your personal email
3. Check if it arrives

### Step 9: Troubleshooting

#### Problem: Website not loading after 6+ hours

**Check:**
```bash
nslookup pawtraits.dev
```

- If shows old IP (not Vercel) → DNS not updated yet, wait longer
- If shows Vercel IP but site doesn't load → Check Vercel dashboard for deployment issues
- If shows no IP → DNS record not added correctly, double-check DNS panel

**Fix:**
1. Verify A record in DNS panel matches Vercel's IP
2. Try clearing browser cache / incognito mode
3. Try accessing via direct IP: `http://76.76.21.21`
4. Check Vercel dashboard → Domains shows "Valid Configuration"

#### Problem: Can't receive email after 24 hours

**Check:**
```bash
nslookup -type=mx pawtraits.dev
```

**If shows no MX records or wrong server:**
1. Go back to DNS panel
2. Verify MX record exists and points to `mail.pawtraits.pics`
3. Try different formats:
   - `mail.pawtraits.pics`
   - `mail.pawtraits.pics.` (with dot)
   - Just `mail` (if your provider auto-appends domain)
4. Save and wait another 4-6 hours

**If shows correct MX records:**
1. Check if you can send email OUT (testing SMTP)
2. Check cPanel email account still exists
3. Check email quota isn't full
4. Contact your hosting provider to verify mail server is running

#### Problem: Email arrives but goes to spam

**This is normal after DNS changes.**

**To improve:**
1. Wait a few days for sender reputation to rebuild
2. Ensure SPF record is correct: `v=spf1 a mx ~all`
3. Ask recipients to mark as "Not Spam"
4. Later (Phase 2) we'll add DKIM and DMARC records

#### Problem: Can receive but not send email

**This is usually an SMTP configuration issue**, not DNS.

**Check your email client settings:**
- **Outgoing Server (SMTP)**: `mail.pawtraits.pics` or `smtp.pawtraits.pics`
- **Port**: Usually 587 (STARTTLS) or 465 (SSL)
- **Authentication**: Must be enabled
- **Username**: Usually your full email address
- **Password**: Your email password

**Or use cPanel webmail** as a temporary solution:
- URL: Usually `https://mail.pawtraits.pics` or `https://pawtraits.pics/webmail`
- Login with your email address and password

## Verification Checklist

After 24 hours, verify everything works:

- [ ] `nslookup pawtraits.dev` shows Vercel IP
- [ ] `https://pawtraits.dev` loads your application
- [ ] `nslookup -type=mx pawtraits.dev` shows mail.pawtraits.pics
- [ ] Can receive email at existing addresses
- [ ] Can send email from existing addresses
- [ ] Email client can connect to IMAP/POP3
- [ ] SPF record exists: https://mxtoolbox.com/spf/pawtraits.dev

## What NOT to Do

❌ **Don't delete ALL DNS records** - only update the ones mentioned above
❌ **Don't change MX records** if they already point to mail.pawtraits.pics
❌ **Don't add Vercel nameservers** - keep your current DNS provider
❌ **Don't panic** if things don't work in the first hour - DNS takes time
❌ **Don't add Resend records yet** - that's Phase 2

## When You're Ready for Phase 2

Once email is working reliably for 2-3 days:
- Set up Resend account
- Verify domain in Resend
- Add DKIM records for Resend
- Update SPF to include Resend
- Add DMARC record
- Test application emails

But for now, **focus only on getting cPanel email working again**.

## Quick Reference - DNS Records You Need

Copy this and fill it in with your values:

```
# pawtraits.dev DNS Records

# Web Hosting (Vercel)
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600

Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600

# Email Hosting (cPanel)
Type: MX
Name: @
Value: mail.pawtraits.pics
Priority: 10
TTL: 3600

# Email Authentication
Type: TXT
Name: @
Value: v=spf1 a mx ~all
TTL: 3600
```

## Support Contacts

If you get stuck:
- **DNS/Domain issues**: Contact your domain registrar support
- **Email not working**: Contact your cPanel hosting provider
- **Website not loading**: Check Vercel support (https://vercel.com/help)

When contacting support, have ready:
1. Domain name (pawtraits.dev)
2. Screenshots of your DNS records
3. What you're trying to accomplish (split web/email hosting)
4. Error messages you're seeing

---

**Remember**: DNS changes take time. Don't make changes twice. Make all changes once, then wait 24-48 hours before troubleshooting.
