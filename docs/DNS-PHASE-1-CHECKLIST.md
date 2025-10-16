# Phase 1: Fix cPanel Email - Simple Checklist

**Goal**: Get email working at pawtraits.dev with Vercel hosting

**Your Mail Server**: `mail.pawtraits.pics`

---

## Before You Start

- [ ] Know where your DNS is managed (domain registrar or hosting provider)
- [ ] Have login credentials for DNS management
- [ ] Have login credentials for cPanel
- [ ] Know which email addresses need to work: ___________________

---

## Step 1: Get Information You Need

### A. Get Vercel IP Address
- [ ] Go to: https://vercel.com/dashboard
- [ ] Select your project → Settings → Domains
- [ ] Add domain: `pawtraits.dev` (if not already added)
- [ ] Note the IP address Vercel shows: ___________________
      (Likely: `76.76.21.21`)

### B. Confirm Your Mail Server
- [ ] Your mail server is: `mail.pawtraits.pics` ✓
- [ ] You can access cPanel webmail to test later

---

## Step 2: Backup Current DNS

- [ ] Log into DNS management for pawtraits.dev
- [ ] Take screenshots of ALL current DNS records
- [ ] Save screenshots somewhere safe

---

## Step 3: Update DNS Records

### Add/Update These Records:

#### Web Hosting → Vercel
```
Type: A
Name: @ (or blank)
Value: 76.76.21.21 (or IP from Vercel)
TTL: 3600
```

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

- [ ] A record added/updated
- [ ] CNAME for www added/updated

#### Email Hosting → cPanel
```
Type: MX
Name: @ (or blank)
Value: mail.pawtraits.pics
Priority: 10
TTL: 3600
```

```
Type: TXT
Name: @ (or blank)
Value: v=spf1 a mx ~all
TTL: 3600
```

- [ ] MX record exists and points to mail.pawtraits.pics
- [ ] SPF record (TXT) added with value: `v=spf1 a mx ~all`

#### Notes:
- If MX record already exists with `mail.pawtraits.pics` → Leave it alone!
- Some DNS providers need trailing dot: `mail.pawtraits.pics.`
- Only ONE SPF record (TXT starting with `v=spf1`)

---

## Step 4: Save and Verify

- [ ] All records saved in DNS panel
- [ ] Take screenshot of updated DNS records
- [ ] Note time DNS updated: _____ : _____ (date/time)

---

## Step 5: Wait for DNS Propagation

**Minimum wait**: 2-4 hours
**Full propagation**: 24-48 hours

- [ ] Waiting since: _________________
- [ ] Next check at: _________________

**During this time**:
- Don't make more DNS changes
- Don't panic if things don't work immediately
- DNS propagation is slow by design

---

## Step 6: Test Website (After 2+ Hours)

### Check DNS Resolution
```bash
nslookup pawtraits.dev
```
- [ ] Shows Vercel IP (76.76.21.21 or similar)

### Visit Website
- [ ] Go to: https://pawtraits.dev
- [ ] Website loads from Vercel
- [ ] No certificate errors (may take extra time)

**If not working**: Wait longer. Check Vercel dashboard for deployment status.

---

## Step 7: Test Email (After 4+ Hours)

### Check MX Records
```bash
nslookup -type=mx pawtraits.dev
```
Or visit: https://mxtoolbox.com/mx/pawtraits.dev

- [ ] Shows: `mail.pawtraits.pics` (priority 10)
- [ ] Does NOT show Vercel servers

### Test Receiving Email
- [ ] Send test email TO: _______________@pawtraits.dev
- [ ] From: Your personal email (Gmail, etc.)
- [ ] Check cPanel webmail inbox
- [ ] Email arrives within 5-10 minutes

### Test Sending Email
- [ ] Log into cPanel webmail or email client
- [ ] Send email FROM: _______________@pawtraits.dev
- [ ] TO: Your personal email
- [ ] Email arrives (check spam folder)

### Test Email Client (Optional)
- [ ] Outlook/Apple Mail/etc. can connect
- [ ] Can send and receive via client

---

## Step 8: Troubleshooting (If Needed After 24 Hours)

### Website Not Loading
**Check**: `nslookup pawtraits.dev`
- Shows old IP? → Wait longer for DNS propagation
- Shows Vercel IP but site doesn't load? → Check Vercel dashboard
- Shows no IP? → Verify A record in DNS panel

### Can't Receive Email
**Check**: `nslookup -type=mx pawtraits.dev`
- No MX records? → Add MX record, try format: `mail.pawtraits.pics.` (with dot)
- Shows wrong server? → Update MX record to `mail.pawtraits.pics`
- Shows correct MX? → Contact hosting provider (mail server may be down)

### Can't Send Email
- This is usually SMTP settings, not DNS
- **Check**: Email client SMTP server = `mail.pawtraits.pics`
- **Check**: Port = 587 or 465
- **Check**: Authentication enabled
- **Try**: cPanel webmail instead (always works)

---

## Verification - All Green Checks = Success!

After 24 hours:

### DNS Resolution
- [ ] `nslookup pawtraits.dev` → Shows Vercel IP
- [ ] `nslookup -type=mx pawtraits.dev` → Shows mail.pawtraits.pics
- [ ] https://mxtoolbox.com/spf/pawtraits.dev → SPF exists

### Website
- [ ] https://pawtraits.dev loads correctly
- [ ] Hosted on Vercel
- [ ] SSL certificate working

### Email
- [ ] Can receive email at all addresses
- [ ] Can send email from all addresses
- [ ] Email client connects successfully
- [ ] Emails don't take more than 1 minute to deliver

---

## When All Tests Pass

**Phase 1 Complete!** 🎉

Wait 2-3 days to ensure stability, then proceed to:
- **Phase 2**: Set up Resend for application emails
- See: `DNS-PHASE-2-RESEND-SETUP.md` (will create later)

---

## Quick Commands Reference

```bash
# Check website DNS
nslookup pawtraits.dev

# Check email DNS
nslookup -type=mx pawtraits.dev

# Check SPF record
nslookup -type=txt pawtraits.dev

# Online tools (use in browser)
https://mxtoolbox.com/mx/pawtraits.dev
https://mxtoolbox.com/spf/pawtraits.dev
```

---

## Support Contacts

**Domain/DNS Issues**:
- Contact: Your domain registrar support
- Have ready: Domain name, screenshots of DNS records

**Email Issues**:
- Contact: Your cPanel hosting provider
- Have ready: Email addresses, error messages

**Website Issues**:
- Contact: Vercel support (https://vercel.com/help)
- Have ready: Deployment URL, error messages

---

## Notes

Use this space to track issues or questions:

```
Issue encountered:


Solution tried:


Result:


```
