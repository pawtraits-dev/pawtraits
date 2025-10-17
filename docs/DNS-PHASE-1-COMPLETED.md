# Phase 1 DNS Configuration - Completed

**Date**: 2025-10-17
**Domain**: pawtraits.pics
**Goal**: Fix email while maintaining Vercel web hosting

## ✅ Changes Made

### 1. MX Record (Email Routing)
**Before:**
```
Type: MX
Destination: pawtraits.pics (pointing to Vercel - wrong)
Priority: 0
```

**After:**
```
Type: MX
Destination: mail.pawtraits.pics (pointing to cPanel mail server)
Priority: 10
```

### 2. Mail Server DNS (A Record)
**Before:**
```
Type: CNAME
Name: mail.pawtraits.pics
Value: pawtraits.pics → 216.150.1.1 (Vercel IP - wrong)
```

**After:**
```
Type: A
Name: mail.pawtraits.pics
Value: 91.238.162.172 (cPanel mail server IP)
```

## ✅ Verified Working

### DNS Resolution
```bash
# MX Record
nslookup -type=mx pawtraits.pics
# Result: mail exchanger = 10 mail.pawtraits.pics ✅

# Mail Server IP
nslookup mail.pawtraits.pics
# Result: Address: 91.238.162.172 ✅
```

### Existing Records (Left Unchanged)
- ✅ **A Record**: pawtraits.pics → Vercel IP (website working)
- ✅ **CNAME**: www.pawtraits.pics → cname.vercel-dns.com
- ✅ **SPF**: v=spf1 ip4:91.238.162.172 include:spf.hostns.io ~all

## 🚧 Outstanding Issue

**Status**: Waiting for hosting provider to fix mail server configuration

**Problem**: Mail server (91.238.162.172) is rejecting incoming email with authentication error:
```
550 Please turn on SMTP Authentication in your mail client, or login to
the IMAP/POP3 server before sending your message. [sender-ip] is not
permitted to relay through this server without authentication.
```

**Root Cause**: Mail server misconfiguration (server-side issue)

**DNS is correct** - this is not a DNS problem.

**Action Taken**: Contacted hosting provider tech support on 2025-10-17

### Email Accounts Verified
- admin@pawtraits.pics - Exists, active, has quota
- Other accounts - Exist, active, have quota
- All accounts show same error when receiving email

### What Hosting Provider Needs to Fix
The mail server at 91.238.162.172 is incorrectly configured to require SMTP authentication for **incoming** email. This is wrong - only **outgoing** email should require authentication.

The server should:
- ✅ Accept incoming SMTP connections on port 25 without authentication
- ✅ Deliver email to local mailboxes for pawtraits.pics domain
- ✅ Require authentication only for outgoing/relay mail (ports 587/465)

## 📊 Architecture Summary

### Current Setup (Correct)
```
Web Traffic:
pawtraits.pics → Vercel (76.76.21.21 or similar) ✅

Email Traffic:
pawtraits.pics → MX: mail.pawtraits.pics → 91.238.162.172 (cPanel) ✅
```

### What Works
- ✅ Website loads correctly (Vercel)
- ✅ DNS resolves correctly (MX and A records)
- ✅ SSL certificate valid

### What Doesn't Work (Yet)
- ❌ Receiving email (mail server config issue)
- ❓ Sending email (untested until receiving works)

## 🎯 Next Steps

### Immediate
1. **Wait for hosting provider** to fix mail server configuration
2. **Test receiving email** once they confirm fix
3. **Test sending email** to verify complete functionality

### After Email Works (Phase 2)
See: `DNS-EMAIL-CONFIGURATION.md` for Phase 2 setup

Phase 2 will add:
- Resend account setup for application emails
- DKIM records for Resend
- Updated SPF to include Resend
- DMARC record
- Application email testing

## 📞 Support Information

**Hosting Provider**: (Your cPanel hosting provider)
**Mail Server IP**: 91.238.162.172
**Support Ticket**: (Add ticket number when received)

## 🔐 Security Notes

- SPF record includes hosting provider's mail servers ✅
- Will add DKIM and DMARC in Phase 2
- Mail server should only allow authenticated relay on ports 587/465
- Port 25 should accept incoming mail without authentication

## 📝 Lessons Learned

1. **Check mail.domain.tld DNS**: When switching to Vercel, ensure mail subdomain points to mail server, not Vercel
2. **MX record destination**: Must point to mail server hostname (mail.domain.com), not root domain
3. **CNAME vs A record**: Mail servers should use A records, not CNAMEs to root domain
4. **DNS vs Server Config**: DNS can be correct but server misconfiguration can still block email
5. **Test incrementally**: Verify each DNS change with nslookup before testing email

## ✅ Phase 1 Status: DNS Complete, Server Config Pending

All DNS configuration from our side is complete and correct. Waiting on hosting provider to fix mail server authentication settings.
