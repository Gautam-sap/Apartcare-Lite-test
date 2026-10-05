# V6.5.14 Build Status

Version: 6.5.14

Validated in the build workspace:
- TypeScript: `tsc --noEmit` PASS
- Python syntax: `python -m py_compile backend/app/main.py` PASS

The final `next build` must be run on the Windows development machine or Vercel because this workspace does not have the Linux Next.js SWC native package and external package download is disabled.

## Windows validation
```bat
npm install
npm run build
```

Then test:
1. Create a fresh apartment account.
2. Log in with the initial password and confirm the mandatory Change Password screen.
3. Create a Viewer/Supervisor and confirm the welcome email and forced password change.
4. Log out and log into a second account; confirm Settings shows only the second tenant values.
5. Upload, Update and Remove the apartment photo.
6. Generate maintenance with Per Unit Price 57.39-equivalent and confirm the displayed rate is 58.
7. Download Image/Excel/WhatsApp report and verify ApartCare Lite + tagline + GKMA Solutions branding.
8. Print All Flats Monthly Report and verify only Water Summary + Water Detail table are printed.
