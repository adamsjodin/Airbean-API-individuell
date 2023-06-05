const express = require('express');
const app = express();
const { usersDb, menuDb, cartDb, guestOrdersDb } = require('./modules/db')
const { checkBodySignup, checkExistingUser, checkToken, checkBodyGuestOrder, checkBodyProductId, checkBodyLogin, checkBodyUserId } = require('./modules/middleware');
const jwt = require('jsonwebtoken')
const { estimatedDelivery } = require('./modules/functions')

const moment = require('moment')
let orderMade = moment();

app.use(express.json());

//Get a list of all items in menu
app.get('/api/beans', async (request, response) => {
    const getBeans = await menuDb.find({});
    response.json({ success: true, beans: getBeans });
});

//Get a list of all users
app.get('/api/users', async (request, response) => {
    const getUsers = await usersDb.find({});
    response.json({ success: true, users: getUsers });
});

//Sign up new user 
//Expected input in body: 
//{
// username: username,
// email: email,
// password: password,
// adress: {
//streetname: streetName,
//zip code: zipCode,
// city: city
//}
//Middleware to check input in body + if username and email already exists
//if not - add user to user database
app.post('/api/signup', checkBodySignup, checkExistingUser, async (request, response) => {
    const newUser = request.body;
    await usersDb.insert(newUser);
    response.json({ success: true, user: newUser });
});

//Login user
//Expected input in body: 
//{
// username: username,
// password: password
//}
//Middleware to check input in body 
//Check if username and password is correct, if so add json webtoken for a limited time
app.post('/api/login', checkBodyLogin, async (request, response) => {
    const user = request.body;
    const existingUser = await usersDb.findOne({ username: user.username });
    if (existingUser) {
        if (existingUser.password === user.password) {
            const token = jwt.sign({ id: existingUser._id }, 'a1b1c1', {
                expiresIn: 3000
            })
            response.send({ success: true, message: "Welcome to AirBean! You are logged in", token: token })
        }
        else {
            response.status(400).send({ success: false, message: "Wrong password, please try again" })
        }
    } else {
        response.status(400).send({ success: false, error: "User does not exist, please try again" });
    }
})

//Add to cart
//Expected input in body: 
//{ id: productid }
//Middleware to check input in body 
//Check if product exist, then add to cart database
//Add date as product id to avoid conflicts with same id
app.post('/api/cart/add', checkBodyProductId, async (request, response) => {
    const product = request.body;
    const findProduct = await menuDb.findOne({ id: product.id })
    if (findProduct) {
        const newCartItem = { ...findProduct, _id: new Date().getTime().toString() };
        cartDb.insert(newCartItem);
        response.send({ success: true, message: "Product added to cart" })
    } else {
        response.status(400).send({ success: false, error: "Product does not exist, please try again" })
    }
})

//Send user order
//Expected input in body: 
//{ id: user id }
//Add token in header as authorization
//Middleware to check input in body 
//Middleware to check if token is valid
//If token is valid - check if user id exist and there is products in cart
//If all is correct, add products in cart to user together with date and total sum of order
//Empty cart and return when order will arrive + order value
app.put('/api/cart/sendorder', checkToken, checkBodyUserId, async (request, response) => {
    const userId = request.body._id;
    const user = await usersDb.findOne({ _id: userId });
    let productsInCart = await cartDb.find({});
    orderMade = moment();
    if (user) {
        if (productsInCart.length > 0) {
            const totalSum = productsInCart.reduce((sum, product) => {
                return sum + product.price;
            }, 0);
            await usersDb.update({ _id: userId }, { $push: { orders: { items: productsInCart, date: orderMade.format(), totalPricePerOrder: totalSum, isDelivered: false } } }, {})
            await cartDb.remove({}, { multi: true })
            response.json({ success: true, message: "You order will be delivered " + orderMade.add(30, 'minutes').calendar() + " and the price will be: " + totalSum + " kr" })
        } else {
            response.status(400).send({ success: false, error: "No products in cart, please try again" })
        }
    } else {
        response.status(400).send({ success: false, message: "The user does not exist. Please try again!" });
    }
})

//Send guest order
//Expected input in body: 
//{
// name: name,
// email: email,
// adress: {
//streetname: streetName,
//zip code: zipCode,
// city: city
//}
//Middleware to check input in body 
//Check if there are products in cart
//If all is correct, add products in cart to guestorder database together with date and total sum of order
//Empty cart and return when order will arrive + order value
app.post('/api/cart/sendguestorder', checkBodyGuestOrder, async (request, response) => {
    const guestOrder = request.body
    const productsInCart = await cartDb.find({})
    orderMade = moment();

    if (productsInCart.length > 0) {
        const overallSum = productsInCart.reduce((sum, order) => {
            return sum + order.price;
        }, 0);
        const newOrder = {
            guestUser: guestOrder,
            products: productsInCart,
            date: orderMade.format(),
            totalSum: overallSum
        }
        await guestOrdersDb.insert(newOrder)
        await cartDb.remove({}, { multi: true })
        response.json({ success: true, newOrder: newOrder, message: "You order will be delivered " + orderMade.add(30, "minutes").calendar() + " and the price will be: " + overallSum + " kr" })
    } else {
        response.status(400).send({ success: false, error: "No products in cart, please try again" })
    }
})

//See order history
//Expected input in body: 
//{ id: user id }
//Add token in header as authorization
//Middleware to check input in body 
//Middleware to check if token is valid
//Check if user exist
//Check if order is delivered
//Return list of orders and total sum of all orders 
app.get('/api/user/orderhistory', checkToken, checkBodyUserId, async (request, response) => {
    const userId = request.body._id;
    await estimatedDelivery(userId);
    const updatedUser = await usersDb.findOne({ _id: userId });
    if (updatedUser) {
        if (updatedUser.orders) {
            const overallSum = updatedUser.orders.reduce((sum, order) => {
                return sum + order.totalPricePerOrder;
            }, 0);
            response.json({ success: true, orders: updatedUser.orders, message: "The total price of all orders are: " + overallSum + " kr" });
        } else {
            response.status(400).send({ success: false, error: "No orders made yet!" });
        }
    } else {
        response.status(400).send({ success: false, error: "The user does not exist, please try again!" });
    }
});

//Start server at port 8000
app.listen(8000, () => {
    console.log('App started on port 8000!');
});


