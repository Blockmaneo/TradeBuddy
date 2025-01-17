const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamCommunity = require('steamcommunity');
const axios = require('axios');
const config = require('./config.js');

class SteamTradeBot {
    constructor() {
        this.client = new SteamUser();
        this.community = new SteamCommunity();
        this.manager = new TradeOfferManager({
            steam: this.client,
            community: this.community,
            language: 'en'
        });

        this.acceptedGames = {
            'CSGO': 730,
            'DOTA2': 570,
            'RUST': 252490
        };

        const { username, password, identitySecret, sharedSecret } = config.steam;
        this.logOn(username, password, identitySecret, sharedSecret);
    }

    logOn(username, password, identitySecret, sharedSecret) {
        const logOnOptions = {
            accountName: username,
            password: password,
            twoFactorCode: SteamTotp.generateAuthCode(sharedSecret)
        };

        this.client.logOn(logOnOptions);

        this.client.on('loggedOn', () => {
            console.log('Logged into Steam');
            this.client.setPersona(SteamUser.EPersonaState.Online);
        });

        this.client.on('webSession', (sessionid, cookies) => {
            this.manager.setCookies(cookies);
            this.community.setCookies(cookies);
        });

        this.client.on('error', (err) => {
            console.error('Steam client error:', err);
        });
    }

    isValidGameItem(appid) {
        return Object.values(this.acceptedGames).includes(appid);
    }

    async getItemPrice(appid, marketHashName) {
        try {
            const response = await axios.get(`https://steamcommunity.com/market/priceoverview/?appid=${appid}&currency=1&market_hash_name=${encodeURIComponent(marketHashName)}`);
            return response.data.lowest_price || 'No price data';
        } catch (error) {
            console.error(`Error fetching price for ${marketHashName}:`, error);
            return 'Price unavailable';
        }
    }

    async handleNewOffer(offer) {
        try {
            const isAdmin = offer.partner.toString() === config.steam.adminID;
            console.log(`Received trade offer ${offer.id} from ${offer.partner.toString()}`);

            if (isAdmin) {
                const result = await offer.accept();
                console.log(`Admin trade ${offer.id} accepted automatically`);
                await this.sendDiscordNotification(offer, true);
                return;
            }

            if (!this.isGiftTrade(offer)) {
                await offer.decline();
                console.log(`Trade offer ${offer.id} declined - not a gift trade`);
                return;
            }

            const validItems = offer.itemsToReceive.every(item => this.isValidGameItem(item.appid));
            
            if (!validItems) {
                await offer.decline();
                console.log(`Trade offer ${offer.id} declined - contains items from unsupported games`);
                return;
            }

            const result = await this.acceptGiftTrade(offer);
            await this.sendDiscordNotification(offer);
        } catch (error) {
            console.error('Error handling trade offer:', error);
            await offer.decline();
        }
    }

    isGiftTrade(offer) {
        return offer.itemsToGive.length === 0 && offer.itemsToReceive.length > 0;
    }

    async acceptGiftTrade(offer) {
        try {
            const result = await offer.accept();
            console.log(`Gift trade ${offer.id} accepted - receiving ${offer.itemsToReceive.length} items`);
            
            try {
                await this.community.postUserComment(offer.partner.toString(), "Thanks for the gift! 🎁");
            } catch (commentError) {
                console.error('Error posting thank you comment:', commentError);
            }
            
            return result;
        } catch (error) {
            console.error('Error accepting gift trade:', error);
            throw error;
        }
    }

    getGameName(appid) {
        return Object.keys(this.acceptedGames).find(key => this.acceptedGames[key] === appid) || 'Unknown Game';
    }

    async calculateTotalValue(items) {
        let total = 0;
        let totalString = '';

        for (const item of items) {
            const price = await this.getItemPrice(item.appid, item.market_hash_name);
            if (price !== 'Price unavailable' && price !== 'No price data') {
                const priceNumber = parseFloat(price.replace('$', ''));
                if (!isNaN(priceNumber)) {
                    total += priceNumber;
                }
            }
        }

        return total > 0 ? `$${total.toFixed(2)}` : 'Unable to calculate total';
    }

    async sendDiscordNotification(offer, isAdmin = false) {
        try {
            const steamID = offer.partner.toString();
            const profileUrl = `https://steamcommunity.com/profiles/${steamID}`;
            
            const itemsWithPrices = await Promise.all(offer.itemsToReceive.map(async item => {
                const price = await this.getItemPrice(item.appid, item.market_hash_name);
                const gameName = this.getGameName(item.appid);
                return `• ${item.name || 'Unknown Item'} (${gameName}) - ${price}`;
            }));

            const totalValue = await this.calculateTotalValue(offer.itemsToReceive);

            const embed = {
                title: isAdmin ? '👑 Admin Trade Received!' : '🎁 New Gift Trade Received!',
                color: isAdmin ? 15844367 : 3066993, // Gold for admin, Green for normal
                fields: [
                    {
                        name: 'Sender Information',
                        value: `Steam ID: ${steamID}\nProfile: [Click Here](${profileUrl})\nStatus: ${isAdmin ? 'Admin' : 'User'}`
                    },
                    {
                        name: `Items Received (${offer.itemsToReceive.length})`,
                        value: itemsWithPrices.join('\n') || 'No items'
                    },
                    {
                        name: 'Total Value',
                        value: totalValue
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: `Trade ID: ${offer.id}`
                }
            };

            if (offer.itemsToReceive[0] && offer.itemsToReceive[0].icon_url) {
                embed.thumbnail = {
                    url: `https://steamcommunity-a.akamaihd.net/economy/image/${offer.itemsToReceive[0].icon_url}`
                };
            }

            await axios.post(config.discord.webhookUrl, {
                username: config.discord.botName,
                avatar_url: config.discord.botAvatar,
                embeds: [embed]
            });
            
            console.log('Discord notification sent successfully');
        } catch (error) {
            console.error('Error sending Discord notification:', error);
        }
    }
}

const bot = new SteamTradeBot();

bot.manager.on('newOffer', (offer) => {
    bot.handleNewOffer(offer);
});

bot.manager.on('error', (error) => {
    console.error('Trade manager error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});
