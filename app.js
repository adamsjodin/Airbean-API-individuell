const express = require('express');
const app = express();
const { usersDb, menuDb, cartDb, guestOrdersDb, campaignsDb } = require('./modules/db');
const { 
    checkBodySignup, 
    checkExistingUser, 
    checkToken, 
    checkBodyGuestOrder, 
    checkBodyProductId, 
    checkBodyLogin, 
    checkBodyUserId, 
    checkAdminRole,
    checkAdminToken
} = require('./modules/middleware');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { estimatedDelivery } = require('./modules/functions');

const moment = require('moment');
let orderMade = moment();

app.use(express.json());

//Get a list of all items in menu
app.get('/api/menu', async (request, response) => {
    const getMenu = await menuDb.find({});
    response.json({ success: true, beans: getMenu });
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
// role: role (use admin for signup as admin, use superuser otherwise)

//Middleware to check input in body + if username and email already exists
//if not - add user to user database
app.post('/api/signup', checkBodySignup, checkExistingUser, async (request, response) => {
    const newUser = request.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newUser.password, salt);
    newUser.password = hashedPassword;

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
        // Jämför det angivna lösenordet med det hashade lösenordet
        const passwordMatch = await bcrypt.compare(user.password, existingUser.password);
        
        if (passwordMatch) {
            const token = jwt.sign({ id: existingUser._id }, 'a1b1c1', {
                expiresIn: 3000
            });
            response.send({ success: true, message: "Welcome to AirBean! You are logged in", token: token });
        } else {
            response.status(400).send({ success: false, message: "Wrong password, please try again" });
        }
    } else {
        response.status(400).send({ success: false, error: "User does not exist, please try again" });
    }
});

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


// --- > ADMIN VIEW STARTS HERE <---- //


//Check if user got admin rights. If so, a admin token is created
app.post('/api/login/admin', checkAdminRole, checkBodyLogin, async (request, response) => {
    const user = request.body;
    const existingUser = await usersDb.findOne({ username: user.username });
    if (existingUser) {
        const comparePassword = await bcrypt.compare(user.password, existingUser.password);

        if (comparePassword && existingUser.role === 'admin') {
            const token = jwt.sign({ id: existingUser._id, username: existingUser.username, role: existingUser.role = "admin"}, 'a1b1c1', {
                expiresIn: 300
            })
            response.send({ success: true, message: "Welcome to AirBean. You are logged in as an admin!", token: token });
        }
        else {
            response.status(400).send({ success: false, message: "Wrong password, please try again" });
        }
    } else {
        response.status(400).send({ success: false, error: "User does not exist, please try again" });
    };
});

//adding product based on token
app.post('/api/admin/addproduct', checkAdminToken, async (request, response) => {
    const { title, desc, price } = request.body;
    const createdAt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" });
    const id = new Date().getTime().toLocaleString();
    const newProduct = {
        id: id,
        title: title,
        desc: desc,
        price: price,
        createdAt: createdAt
    };
    
    if (!title || !desc || !price) {
        response.status(400).send({ success: false, message: 'Please verify that title, desc, and price are correct!' });
    } else {
        // verify based on title if product already exist
        const existingProduct = await menuDb.findOne({ title: title });

        if (existingProduct) {
            response.status(409).send({ success: false, message: 'Product already exists!' });
        } else {
            await menuDb.insert(newProduct);
            response.send({ success: true, message: 'Menu updated with new product!' });
        }
    }
});

//Updating product based on token
app.put('/api/admin/updateproduct', checkAdminToken, async (request, response) => {
    const { id, title, desc, price } = request.body;
    const existingProduct = await menuDb.findOne({ id: id });

    if (existingProduct) {
        existingProduct.title = title;
        existingProduct.desc = desc;
        existingProduct.price = price;
        existingProduct.modifiedAt = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" });

        await menuDb.update({ id: id }, existingProduct);
        response.send({ success: true, message: 'Product updated successfully!' });
    } else {
        response.status(404).send({ success: false, message: 'Product not found!' });
    };
});

//Deleting product based on token
app.delete('/api/admin/deleteproduct', checkAdminToken, async (request, response) => {
    const productToDelete = request.body.id;
    const existingProductToDelete = await menuDb.findOne({ id: productToDelete });

    if (existingProductToDelete) {
        await menuDb.remove({ id: productToDelete })
        response.send({ success: true, message: 'Product sucessfully deleted!' });
    } else {
        response.status(404).send({ success: false, message: 'Could not find the product!' });
    };
});

app.post('/api/admin/addcampaigns', checkAdminToken, async (request, response) =>{
    const addCampaigns = request.body;
    if (addCampaigns) {
        await campaignsDb.insert(addCampaigns);
        response.send({ success: true, campaigns: addCampaigns})
    } else {
        response.status(404).send({ success: false, message: 'Could not add the campaigns!' });
    };
});

app.get('/api/user/campaigns', async (request, response) => {
    const getCampaigns = await campaignsDb.find({});
    if (getCampaigns) {
        response.send({ success: true, campaigns: getCampaigns })
    } else {
        response.status(404).send({ success: false, message: 'Could not find the campaigns!' });
    };
});

//Start server at port 8000
app.listen(8000, () => {
    console.log('App started on port 8000!');
});


// Saker att fixa
//1 fixa en get till campains - Klar
//2 fixa en rountes till app -
//3 städa koden
//4 fixa så admin kan skicka beställningar och kolla historik - Klar
