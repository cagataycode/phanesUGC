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
1. **loader-utils 3.x** is available and fixes all ReDoS and prototype pollution issues (major version upgrade from 2.x)
2. **path-to-regexp 8.4.1** is available and fixes all ReDoS vulnerabilities (patch version)
3. **picomatch 4.0.4** is available and fixes method injection and ReDoS (patch version)
4. **@tootallnate/once 3.0.1** is available and fixes control flow scoping issues
5. Most fixes can be applied via **npm overrides**; loader-utils requires testing due to major version change

---

## Phase 1: Fix loader-utils (CRITICAL) via npm overrides
**Priority**: CRITICAL  
**Risk**: Medium (major-version override from 2.x to 3.3.1; requires targeted Remotion/bundler regression testing)  
**Estimated Time**: 10 minutes (including testing)

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
  - Method injection in POSIX character classes (GHSA-3v7f-55p6-f55p)
  - ReDoS via extglob quantifiers (GHSA-c2c7-rcm5-vvqj)
- **Affected**: @nestjs/cli 11.0.17 (dev dependency only)

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

## Phase 4: Address @tootallnate/once (LOW) - Apply Overrides
**Priority**: LOW  
**Risk**: Medium (major version upgrades in deep dependency chain: http-proxy-agent 5→8, teeny-request 9→10, retry-request 7→8)  
**Estimated Time**: 10 minutes (including testing)

### Issue
- **Package**: @tootallnate/once <3.0.1
- **Severity**: Low
- **Vulnerability**: Incorrect control flow scoping (CVE-2026-3449)
- **Affected**: firebase-admin 13.7.0 → @google-cloud/storage 7.19.0 → http-proxy-agent → @tootallnate/once

### Analysis
- Firebase Admin 13.7.0 release notes state it "addresses vulnerability CVE-2026-25128"
- However, npm audit still reports the vulnerability in the dependency chain
- The vulnerability is in a deep dependency chain (4 levels deep)
- Fixing requires overriding multiple packages with major version upgrades

### Solution
**Apply npm overrides** to force patched versions throughout the Google Cloud dependency chain

### Implementation Steps
```bash
# 1. Add overrides to package.json
# Update overrides section:
{
  "overrides": {
    "loader-utils": "^3.3.1",
    "path-to-regexp": "^8.4.1",
    "picomatch": "^4.0.4",
    "@tootallnate/once": "^3.0.1",
    "http-proxy-agent": "^8.0.0",
    "teeny-request": "^10.1.2",
    "retry-request": "^8.0.2"
  }
}

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Verify fix
npm audit

# 4. Run tests (IMPORTANT - major version changes)
npm run lint
npm run test:unit
npm run test:e2e

# 5. Test GCS operations manually
# - Upload a file
# - Download a file
# - Create signed URLs

# 6. Commit
git add package.json package-lock.json
git commit -m "fix: Phase 4 - override Google Cloud dependency chain to eliminate LOW vulnerabilities

- Override @tootallnate/once to 3.0.1 (fixes CVE-2026-3449)
- Override http-proxy-agent to 8.0.0 (major version upgrade)
- Override teeny-request to 10.1.2 (major version upgrade)
- Override retry-request to 8.0.2 (major version upgrade)
- Fixes entire Google Cloud/Firebase dependency chain
- Reduces vulnerabilities from 8 to 0 (100% elimination)
- REQUIRES TESTING: Major version upgrades in HTTP proxy chain"
```

### Expected Outcome
- Low vulnerabilities: 8 → 0
- Total vulnerabilities: 8 → 0 ✅
- ALL VULNERABILITIES ELIMINATED

### Testing Requirements
⚠️ **CRITICAL**: These are major version upgrades in the HTTP proxy chain used by Google Cloud Storage and Firebase Admin. Thorough testing is required:

1. **Unit tests**: Must pass
2. **E2E tests**: Must pass
3. **Manual GCS testing**:
   - Upload files to GCS
   - Download files from GCS
   - Create signed URLs
   - Verify Firebase Admin operations
4. **Integration testing**:
   - Test video generation workflow end-to-end
   - Verify asset uploads work correctly

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
- **Total**: 0 vulnerabilities ✅
- **Critical**: 0 ✅
- **High**: 0 ✅
- **Moderate**: 0 ✅
- **Low**: 0 ✅
- **Production Risk**: VERY LOW ✅

---

## Risk Assessment

### npm Overrides Safety
- **loader-utils**: 2.0.3 → 3.3.1 (major version, requires testing - API changes possible)
- **path-to-regexp**: 8.3.0 → 8.4.1 (patch version, safe)
- **picomatch**: 4.0.3 → 4.0.4 (patch version, safe)
- **@tootallnate/once**: <3.0.1 → 3.0.1 (patch version, safe)
- **http-proxy-agent**: 5.0.0 → 8.0.0 (major version, requires testing - breaking changes possible)
- **teeny-request**: 9.x → 10.1.2 (major version, requires testing)
- **retry-request**: 7.x → 8.0.2 (major version, requires testing)

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
