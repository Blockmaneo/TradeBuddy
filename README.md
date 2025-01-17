## Steam Trade Bot

An advanced bot designed to automate Steam trading tasks, manage gift trades, and send real-time notifications to Discord, among other features.

****Features****

- **Trade Handling:**
  - Automatically accept gift trades.
  - Validate items based on supported games (CS:GO, Dota 2, Rust).

- **Price Checking:**
  - Fetch item prices directly from the Steam Community Market.

- **Discord Notifications:**
  - Notify a designated Discord channel with detailed trade information, including item prices and sender details.

- **Admin Features:**
  - Automatically accept trades from admin users.
  
- **Comments:**
  - Post a thank-you comment on the sender's Steam profile after a successful trade.

****Setup****

1. **Install Dependencies:**
   Run the following command in your project root:

   ```
   npm install steam-user steam-totp steam-tradeoffer-manager steamcommunity axios
   ```

2. **Configure Your Steam Account:**
   - **Identity Secret & Shared Secret:** Required for Steam Guard 2FA. Obtain these using tools like Steam Desktop Authenticator.
   - **Admin ID:** Provide your Steam account's 64-bit ID for admin trade privileges.

3. **Configure Your Discord Webhook:**
   Go to your Discord server settings → Integrations → Webhooks → Create a Webhook. Copy the Webhook URL and paste it into config.js.

4. **Run the Bot:**
   Start the bot using:

   ```
   node index.js
   ```

****Permission Requirements****

- The bot requires access to the Steam Web API and must have Steam Community features enabled.
- Ensure that webhooks are configured in the target Discord channel.

****Security Notice****

Keep your config.js file secure. Never share your Steam credentials, secrets, or Discord webhook URL. It is advisable to use environment variables or .env files for enhanced security.

****Support****

If you encounter any issues or need assistance:

- Check the issues section of the GitHub repository.
- Create a new issue with detailed information about your problem.
- Join our Discord server (coming soon).
