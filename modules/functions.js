const {usersDb} = require('./db');
const moment = require('moment')

//compare current time with order time
//if difference is more than 30 minutes the status
//of isDelivered will change to true
async function estimatedDelivery(userId) {
  let currentTime = moment();
  const user = await usersDb.findOne({ _id: userId });
  if (user.orders) {
      for(const [index, element] of user.orders.entries()) {
          let deliveredTime = element.date;
          let result =  currentTime.diff(deliveredTime, 'minutes');
          if (result >= 30 && !element.isDelivered) {
              await usersDb.update({ _id: userId }, { $set: { [`orders.${index}.isDelivered`]: true } });
          } 
      };
  }
}

module.exports =  { estimatedDelivery }