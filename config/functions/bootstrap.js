module.exports = async () => {

  // The `md-email` Markdown email plugin is used for the outgoing emails
  if (Object.keys(strapi.plugins).indexOf('md-email') === -1) {
    throw new Error(
      'This plugin uses the "md-email" plugin for sending emails, please install md-email first.'
    );
  }

  // Ensure we only run the setup once
  const initialSetup = await isFirstRun();
  if (!initialSetup) return;

  try {
    console.log('Initializing the "email-notifications" plugin...');

    // Make the request/verify endpoints publicly accessible
    await setRolePermissions({
      'verification': ['request', 'verify'],
    }, 'email-verification', 'public');

    // Finished initial setup
    await completedFirstRun();
    console.log('All done.');

  } catch (error) {
    console.log('Could not finish initialization!');
    console.error(error);
  }

};

async function pluginStore() {
  return strapi.store({
    environment: strapi.config.environment,
    type: "plugin_email-verification",
    name: "bootstrap",
  });
}

async function isFirstRun() {
  const store = await pluginStore();
  return !( await store.get({ key: "initialized" }) );
}

async function completedFirstRun() {
  const store = await pluginStore();
  await store.set({ key: "initialized", value: true });
}


async function setRolePermissions(newPermissions, permissionType = 'application', roleType = 'public') {
  // Find the ID of the public role
  const role = await strapi
    .query("role", "users-permissions")
    .findOne({ type: roleType });

  // List all available permissions
  const permissions = await strapi
    .query("permission", "users-permissions")
    .find({
      type: [permissionType],
      role: role.id,
    });

  // Update permission to match new config
  const controllersToUpdate = Object.keys(newPermissions);
  const updatePromises = permissions
    .filter((permission) => {
      // Only update permissions included in newConfig
      if (!controllersToUpdate.includes(permission.controller)) {
        return false;
      }
      if (!newPermissions[permission.controller].includes(permission.action)) {
        return false;
      }
      return true;
    })
    .map((permission) => {
      // Enable the selected permissions
      return strapi
        .query("permission", "users-permissions")
        .update({ id: permission.id }, { enabled: true })
    });
  await Promise.all(updatePromises);
}
