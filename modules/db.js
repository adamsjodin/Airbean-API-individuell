//Create databases

const nedb = require('nedb-promise');
const menuDb = new nedb({ filename: 'databases/menu.db', autoload: true });
const usersDb = new nedb({ filename: 'databases/users.db', autoload: true });
const cartDb = new nedb({ filename: 'databases/cart.db', autoload: true });
const guestOrdersDb = new nedb({ filename: 'databases/guestorders.db', autoload: true })
const campaignsDb = new nedb({ filename: 'databases/campaigns.db', autoload: true })

module.exports = {usersDb, menuDb, cartDb, guestOrdersDb, campaignsDb}