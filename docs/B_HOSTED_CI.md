# B hosted publication

This workflow builds the existing business version with locked pnpm dependencies on GitHub hosted Ubuntu 24.04. B receives only the existing minimal runtime. The initial infrastructure commit skips automatic CI; run validate_only=true before the first normal publication. Future main pushes publish normally.

The existing B_DEPLOY_SSH_KEY and B_DEPLOY_KNOWN_HOSTS Secrets are reused unchanged. On B the existing key is constrained by restrict plus a root-owned forced gateway. Only the original three application checks, fixed incoming-directory rsync receiver and existing deploy-experiments helper are permitted. No new key, source restriction relaxation, sudo rule or application directory is required.

Validation builds and checks the existing service without uploading or restarting, and proves shell, private path reads and other services are denied by the actual key. Successful publication retains one version; the existing server helper restores the old current version if health fails. Business source, dependencies and runtime protocol are unchanged.
