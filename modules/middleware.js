const { usersDb } = require('./db');
const jwt = require('jsonwebtoken');

//Check if fields in body is correct for adding new user
function checkBodySignup(request, response, next) {
  const newUser = request.body;
  if (
    (newUser.hasOwnProperty("username") && newUser.username.length !== 0) &&
    (newUser.hasOwnProperty("email") && newUser.email.length !== 0) &&
    (newUser.hasOwnProperty("password") && newUser.password.length !== 0) &&
    (newUser.adress.hasOwnProperty("streetname") && newUser.adress.streetname.length !== 0) &&
    (newUser.adress.hasOwnProperty("zipcode") && newUser.adress.zipcode.length !== 0) &&
    (newUser.adress.hasOwnProperty("city") && newUser.adress.city.length !== 0)
  ) {
    next();
  } else {
    response.status(400).send({ success: false, error: 'Wrong input, please try again' });
  }
}

//Check if fields in body is correct for adding guest order
function checkBodyGuestOrder(request, response, next) {
  const newUser = request.body;
  if (
    (newUser.hasOwnProperty("name") && newUser.name.length !== 0) &&
    (newUser.hasOwnProperty("email") && newUser.email.length !== 0) &&
    (newUser.adress.hasOwnProperty("streetname") && newUser.adress.streetname.length !== 0) &&
    (newUser.adress.hasOwnProperty("zipcode") && newUser.adress.zipcode.length !== 0) &&
    (newUser.adress.hasOwnProperty("city") && newUser.adress.city.length !== 0)
  ) {
    next();
  } else {
    response.status(400).send({ success: false, error: 'Wrong input, please try again' });
  }
}

//Check if username and email exist
async function checkExistingUser(request, response, next) {
  const { username, email } = request.body
  const existingUser = await usersDb.findOne({ $or: [{ username: username }, { email: email }] });
  if (existingUser && existingUser.username === username) {
    response.status(400).send({ success: false, message: "Username already exists, please try to login or request new password" });
  } else if (existingUser && existingUser.email === email) {
    response.status(400).send({ success: false, message: "Email already exists, please try to login or request new password" });
  } else {
    next();
  }
}
//Check if fields in body is correct
function checkBodyProductId(request, response, next) {
  const product = request.body
  if (product.hasOwnProperty("id") && product.id.length !== 0) {
    next()
  } else {
    response.status(400).send({ success: false, error: "Wrong input, please try again" })
  }
}

//Check if fields in body is correct
function checkBodyLogin(request, response, next) {
  const user = request.body
  if ((user.hasOwnProperty("username") && user.username.length !== 0) &&
    (user.hasOwnProperty("password") && user.password.length !== 0)) {
    next()
  } else {
    response.status(400).send({ success: false, error: "Wrong input, please try again" })
  }
}

//Check if fields in body is correct
function checkBodyUserId(request, response, next) {
  const user = request.body
  if (user.hasOwnProperty("_id") && user._id.length !== 0) {
    next()
  } else {
    response.status(400).send({ success: false, error: "Wrong input, please try again" })
  }
}

//Check if token is valid
function checkToken(request, response, next) {
  const userId = request.body._id;
  const token = request.headers.authorization
  try {
    const data = jwt.verify(token, 'a1b1c1')
    if (data.id === userId) {
      next()
    } else {
      response.json({ success: false, error: 'Invalid token' })
    }
  } catch (error) {
    response.json({ success: false, error: 'Invalid token' })
  }
}

module.exports = { checkBodySignup, checkExistingUser, checkToken, checkBodyGuestOrder, checkBodyProductId, checkBodyLogin, checkBodyUserId }