# 4-Phase Security Vulnerability Fix Plan
**Date**: March 31, 2026  
**Current Status**: 19 vulnerabilities (8 low, 4 moderate, 6 high, 1 critical)

## Research Summary (March 2026)

### Available Package Versions
- **loader-utils**: Latest is 3.3.1 (fixes all vulnerabilities in 2.0.x)
- **path-to-regexp**: Latest is 8.4.1 (fixes vulnerabilities in 8.0.0-8.3.0)
- **picomatch**: Latest is 4.0.4 (fixes vulnerabilities in 4.0.0-4.0.3)
- **@google-cloud/storage**: Current 7.19.0 (latest stable)
- **NestJS**: Current 11.1.17 (needs path-to-regexp override)
- **Remotion**: Current 4.0.442 (needs loader-utils override)

### Key Findings
1. **loader-utils 3.x** is available and fixes all ReDoS and prototype pollution issues
2. **path-to-regexp 8.4.1** is available and fixes all ReDoS vulnerabilities
3. **picomatch 4.0.4** is available and fixes method injection and ReDoS
4. All fixes can be applied via **npm overrides** without breaking changes

---

## Phase 1: Fix loader-utils (CRITICAL) via npm overrides
**Priority**: CRITICAL  
**Risk**: Low (overrides are safe for patch versions)  
**Estimated Time**: 5 minutes

### Issue
- **Package**: loader-utils 2.0.0 - 2.0.3
- **Severity**: Critical
- **Vulnerabilities**: 
  - Prototype pollution (CVE-2022-37601)
  - ReDoS via url variable (CVE-2022-37603)
  - ReDoS (CVE-2022-37599)
- **Affected**: @remotion/bundler 4.0.442

### Solution
Use npm overrides to force loader-utils to 3.3.1 (latest stable)

### Implementation Steps
```bash
# 1. Add override to package.json
# Add this to package.json:
{
  "overrides": {
    "loader-utils": "^3.3.1"
  }
}

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Verify fix
npm audit | grep -A 5 "loader-utils"

# 4. Run tests
npm run lint
npm run test:unit

# 5. Commit
git add package.json package-lock.json
git commit -m "fix: override loader-utils to 3.3.1 to fix critical vulnerabilities

- Fix prototype pollution (CVE-2022-37601)
- Fix ReDoS vulnerabilities (CVE-2022-37603, CVE-2022-37599)
- Use npm overrides to force loader-utils@3.3.1 in Remotion dependency chain
- Reduces critical vulnerabilities from 1 to 0"
```

### Expected Outcome
- Critical vulnerabilities: 1 → 0
- Total vulnerabilities: 19 → ~15

---

## Phase 2: Fix path-to-regexp (HIGH) via npm overrides
**Priority**: HIGH  
**Risk**: Low (overrides are safe for patch versions)  
**Estimated Time**: 5 minutes

### Issue
- **Package**: path-to-regexp 8.0.0 - 8.3.0
- **Severity**: High
- **Vulnerabilities**:
  - ReDoS via sequential optional groups (CVE-2024-45296)
  - ReDoS via multiple wildcards (CVE-2024-45297)
- **Affected**: @nestjs/core 11.1.17, @nestjs/platform-express 11.1.17, @nestjs/testing 11.1.17

### Solution
Use npm overrides to force path-to-regexp to 8.4.1 (latest stable with fixes)

### Implementation Steps
```bash
# 1. Add override to package.json
# Update overrides section:
{
  "overrides": {
    "loader-utils": "^3.3.1",
    "path-to-regexp": "^8.4.1"
  }
}

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Verify fix
npm audit | grep -A 5 "path-to-regexp"

# 4. Run tests (important - routing behavior might change)
npm run lint
npm run test:unit
npm run test:e2e

# 5. Commit
git add package.json package-lock.json
git commit -m "fix: override path-to-regexp to 8.4.1 to fix ReDoS vulnerabilities

- Fix ReDoS via sequential optional groups (CVE-2024-45296)
- Fix ReDoS via multiple wildcards (CVE-2024-45297)
- Use npm overrides to force path-to-regexp@8.4.1 in NestJS dependency chain
- Reduces high severity vulnerabilities"
```

### Expected Outcome
- High vulnerabilities: 6 → ~3
- Total vulnerabilities: ~15 → ~12

---

## Phase 3: Fix picomatch (HIGH) via npm overrides
**Priority**: HIGH (Dev dependency only)  
**Risk**: Very Low (dev dependency, doesn't affect production)  
**Estimated Time**: 5 minutes

### Issue
- **Package**: picomatch 4.0.0 - 4.0.3
- **Severity**: High
- **Vulnerabilities**:
  - Method injection in POSIX character classes (CVE-2024-XXXXX)
  - ReDoS via extglob quantifiers (CVE-2024-XXXXX)
- **Affected**: @nestjs/cli 11.0.16 (dev dependency only)

### Solution
Use npm overrides to force picomatch to 4.0.4 (latest stable with fixes)

### Implementation Steps
```bash
# 1. Add override to package.json
# Update overrides section:
{
  "overrides": {
    "loader-utils": "^3.3.1",
    "path-to-regexp": "^8.4.1",
    "picomatch": "^4.0.4"
  }
}

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Verify fix
npm audit | grep -A 5 "picomatch"

# 4. Run tests
npm run lint
npm run test:unit

# 5. Commit
git add package.json package-lock.json
git commit -m "fix: override picomatch to 4.0.4 to fix ReDoS vulnerabilities

- Fix method injection in POSIX character classes
- Fix ReDoS via extglob quantifiers
- Use npm overrides to force picomatch@4.0.4 in @nestjs/cli chain
- Dev dependency only, no production impact"
```

### Expected Outcome
- High vulnerabilities: ~3 → ~1
- Total vulnerabilities: ~12 → ~9

---

## Phase 4: Address @tootallnate/once (LOW) - Monitor Only
**Priority**: LOW  
**Risk**: Very Low (indirect dependency, limited exposure)  
**Estimated Time**: Documentation only

### Issue
- **Package**: @tootallnate/once <3.0.1
- **Severity**: Low
- **Vulnerability**: Incorrect control flow scoping (CVE-2026-25128)
- **Affected**: firebase-admin 13.7.0 → @google-cloud/storage 7.19.0 → http-proxy-agent → @tootallnate/once

### Analysis
- Firebase Admin 13.7.0 release notes state it "addresses vulnerability CVE-2026-25128"
- The vulnerability is in a deep dependency chain (4 levels deep)
- Very low severity and limited exposure
- Downgrading @google-cloud/storage to 5.18.3 would be a breaking change

### Solution
**Monitor and document** - No immediate action required

### Implementation Steps
```bash
# 1. Document the status
# Update SECURITY_AUDIT_SUMMARY.md with:
# - Confirmed Firebase Admin 13.7.0 addresses CVE-2026-25128
# - Risk assessment: Very Low
# - Action: Monitor for @google-cloud/storage updates

# 2. Set up monitoring
# Add to package.json scripts:
{
  "scripts": {
    "security:check": "npm audit --audit-level=moderate",
    "security:report": "npm audit --json > security-audit.json"
  }
}

# 3. Commit documentation
git add package.json SECURITY_AUDIT_SUMMARY.md
git commit -m "docs: document @tootallnate/once monitoring strategy

- CVE-2026-25128 addressed by Firebase Admin 13.7.0
- Risk level: Very Low (indirect dependency, limited exposure)
- Action: Monitor for upstream fixes, no immediate action required
- Add security check scripts for ongoing monitoring"
```

### Expected Outcome
- Low vulnerabilities: ~8 (documented and monitored)
- Total vulnerabilities: ~9 (all documented with mitigation strategies)

---

## Summary of Expected Results

### Before (Current State)
- **Total**: 19 vulnerabilities
- **Critical**: 1 (loader-utils)
- **High**: 6 (path-to-regexp, picomatch)
- **Moderate**: 4
- **Low**: 8 (@tootallnate/once chain)

### After Phase 1
- **Total**: ~15 vulnerabilities
- **Critical**: 0 ✅
- **High**: 6
- **Moderate**: 4
- **Low**: ~5

### After Phase 2
- **Total**: ~12 vulnerabilities
- **Critical**: 0 ✅
- **High**: ~3
- **Moderate**: 4
- **Low**: ~5

### After Phase 3
- **Total**: ~9 vulnerabilities
- **Critical**: 0 ✅
- **High**: ~1
- **Moderate**: 4
- **Low**: ~4

### After Phase 4 (Final)
- **Total**: ~9 vulnerabilities (all documented and monitored)
- **Critical**: 0 ✅
- **High**: 0-1 (if any remain, documented with mitigation)
- **Moderate**: ~4 (low risk, indirect dependencies)
- **Low**: ~4-5 (documented, monitoring in place)
- **Production Risk**: VERY LOW ✅

---

## Risk Assessment

### npm Overrides Safety
- **loader-utils**: 2.0.3 → 3.3.1 (major version, but backward compatible API)
- **path-to-regexp**: 8.3.0 → 8.4.1 (patch version, safe)
- **picomatch**: 4.0.3 → 4.0.4 (patch version, safe)

### Testing Requirements
- ✅ Lint must pass after each phase
- ✅ Unit tests must pass after each phase
- ⚠️ E2E tests must pass after Phase 2 (path-to-regexp affects routing)
- ✅ Manual smoke test of video rendering after Phase 1 (loader-utils affects Remotion)

### Rollback Plan
If any phase causes issues:
```bash
# Remove the problematic override from package.json
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Revert the commit
git revert HEAD
```

---

## Post-Implementation Checklist

- [ ] Phase 1: loader-utils override applied and tested
- [ ] Phase 2: path-to-regexp override applied and tested
- [ ] Phase 3: picomatch override applied and tested
- [ ] Phase 4: Documentation updated and monitoring in place
- [ ] All tests passing (lint, unit, e2e)
- [ ] Security audit shows expected reduction in vulnerabilities
- [ ] SECURITY_AUDIT_SUMMARY.md updated with final results
- [ ] Team notified of changes and any behavioral differences

---

## Maintenance Plan

### Ongoing Monitoring
1. Run `npm audit` weekly
2. Check for upstream fixes in:
   - Remotion (for native loader-utils fix)
   - NestJS (for native path-to-regexp fix)
   - @google-cloud/storage (for @tootallnate/once fix)

### Future Updates
1. When Remotion natively supports loader-utils 3.x, remove override
2. When NestJS natively supports path-to-regexp 8.4+, remove override
3. When picomatch 4.0.4+ is natively used by @nestjs/cli, remove override

### Quarterly Review
- Review all npm overrides
- Check if overrides can be removed
- Update to latest stable versions
- Re-run full security audit
