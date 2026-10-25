<?php

// The old localhost Deployer/PM2 recipe targeted server A. Keep this guard so
// manual use cannot accidentally reactivate the retired instance there.
fwrite(STDERR, "Deployment moved to server B. Run the GitHub production workflow or bash scripts/deploy-to-b.sh after packaging the runtime.\n");
exit(1);
