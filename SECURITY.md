# Security Guidelines

## 🔒 Environment Variables

**NEVER commit the `.env` file to version control!**

### Setup Instructions

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual values in `.env`

3. Verify `.env` is in `.gitignore` (it should already be there)

### Sensitive Information

The following values in `.env` are **CRITICAL** and must remain secret:

- `POSTGRES_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)
- `WINDOWS_SSH_PASSWORD` - SSH access password
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `SAP_ENDPOINT` - Internal SAP server URL

## 🔐 GitHub Token Security

If your GitHub token has been exposed:

1. **Immediately revoke it** at: https://github.com/settings/tokens
2. Generate a new token with minimal required permissions
3. Update your `.env` file with the new token
4. Never share or commit tokens to version control

## 📋 Pre-Commit Checklist

Before committing code, verify:

- [ ] `.env` is NOT in your commit
- [ ] No passwords or secrets in code
- [ ] `.env.example` only contains placeholder values
- [ ] `.gitignore` includes `.env`

## 🚨 What to Do If Credentials Are Leaked

1. **Rotate all credentials immediately**
2. Revoke exposed GitHub tokens
3. Change database passwords
4. Update JWT secrets
5. Notify your security team

## 📝 Best Practices

1. Use strong, unique passwords (minimum 16 characters)
2. Use environment-specific `.env` files (`.env.development`, `.env.production`)
3. Never log sensitive information
4. Use secrets management tools for production (AWS Secrets Manager, Azure Key Vault, etc.)
5. Regularly rotate credentials

## 🔍 Security Audit

To check if sensitive data was accidentally committed:

```bash
# Check current status
git status

# Search for potential secrets in history
git log --all --full-history -- .env

# Search for passwords in code
git grep -i "password"
```

## 📞 Contact

If you discover a security vulnerability, please report it to:
- Email: security@bluesystem.io
- Do NOT create public GitHub issues for security vulnerabilities
