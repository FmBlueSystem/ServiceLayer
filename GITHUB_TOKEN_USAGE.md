# GitHub Token Usage Guide

## Token Location
The GitHub Personal Access Token is securely stored in:
```
/Users/freddymolina/Desktop/ServiceLayer/.env.local
```

## Token Details
- **Token**: `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`
- **Repository**: https://github.com/FmBlueSystem/ServiceLayer.git
- **Owner**: FmBlueSystem
- **Repository Name**: ServiceLayer

## Security Notes
- ✅ The `.env.local` file is automatically excluded from version control
- ✅ The token will never be committed to the repository
- ⚠️ Keep this token secure and do not share it publicly
- ⚠️ If compromised, regenerate the token in GitHub settings

## Usage Examples

### Clone Repository
```bash
git clone https://github.com/FmBlueSystem/ServiceLayer.git
```

### Push with Token (if needed)
```bash
git remote set-url origin https://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@github.com/FmBlueSystem/ServiceLayer.git
git push origin master
```

### Using GitHub CLI
```bash
export GITHUB_TOKEN=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
gh repo view FmBlueSystem/ServiceLayer
```

## Current Repository Status
- ✅ All CORS fixes have been committed and pushed
- ✅ FichasTecn module is working properly
- ✅ Authentication system is consistent across all pages
- ✅ Latest commit: `28a00c6` - "fix: Resolve CORS issues in FichasTecn module"

## Repository Structure
```
ServiceLayer/
├── .env.local              # GitHub token (secure, not committed)
├── .gitignore              # Excludes sensitive files
├── HANA_VIEW_CREATION.md   # SAP HANA view documentation
├── my-app/                 # Main application
│   └── my-app/
│       ├── src/            # Backend source code
│       ├── public/         # Frontend files
│       └── package.json    # Dependencies
└── README.md               # Project documentation
```

## Support
If you need to regenerate the token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with repository access
3. Update the `.env.local` file with the new token