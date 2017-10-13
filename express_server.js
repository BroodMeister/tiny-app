// Required modules.
const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');


// App setup.
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({
  name: "session",
  keys: ["This-is-my-secrete-key"],
  maxAge: 60 * 60 * 1000 // 1 hour
}));

// Global variables.
const PORT = process.env.PORT || 8080; // default port 8080
const urlDatabase = {
  "b2xVn2": {
    url: "http://www.lighthouselabs.ca",
    userID: "userRandomID"
  },
  "9sm5xK": {
    url: "http://www.google.com",
    userID: "user2RandomID"
  }
};
const users = {
  "userRandomID": {
    id: "userRandomID",
    email: "user@example.com",
    password: "purple-monkey-dinosaur"
  },
  "user2RandomID": {
    id: "user2RandomID",
    email: "user2@example.com",
    password: "dishwasher-funk"
  }
};

// Generates a randomized short URL.
function generateRandomString() {
  return Math.floor(Math.random() * 1e10).toString(32);
}

// Adds the new URL into the database.
function addUrl(longUrl, user) {
  let newShortUrl = "";
  do {
    newShortUrl = generateRandomString(6);
  } while(urlDatabase[newShortUrl])
  urlDatabase[newShortUrl] = { url: longUrl, userID: user };
  return newShortUrl;
}

// Adds the newly created user into the database.
function addUser(email, password) {
  let newUserId = "";
  do {
    newUserId = generateRandomString(6);
  } while(users[newUserId])
  users[newUserId] = {
    id: newUserId,
    email: email,
    password: bcrypt.hashSync(password, 10)
  };
  return newUserId;
}

// Checks to see if the provided email exists in the database.
function canRegistered(email) {
  let flag = true;
  for (let user in users) {
    if (users[user].email === email) {
      return false;
    }
  }
  return true;
}

// Returns the user id that matches the email and password.
function findUser(email, password) {
  for (let user in users) {
    if (users[user].email === email
      && bcrypt.compareSync(password, users[user].password)) {
      return user;
    }
  }
  return "";
}

function urlsForUser(id) {
  let subset = {};
  for (let url in urlDatabase) {
    if (urlDatabase[url].userID === id) {
      subset[url] = urlDatabase[url];
    }
  }
  return subset;
}

// Request-response:
app.get("/", (req, res) => {
  res.end("Hello!\n");
});

app.get("/urls.json", (req, res) => {
  res.json(urlDatabase);
});

app.get("/users.json", (req, res) => {
  res.json(users);
});

app.get("/urls", (req, res) => {
  let userId = req.session.user_id;
  let urls = urlsForUser(userId);
  if (!userId || !users[userId]) {
    res.redirect("/login");
  } else {
    let templateVars = {
      urls: urls,
      user: users[userId].email
    };
    res.render("urls_index", templateVars);
  }
});

app.get("/urls/:id", (req, res) => {
  let shortUrl = req.params.id;
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.sendStatus(401);
  } else if (!urlDatabase[shortUrl]){
    res.sendStatus(404);
  }  else if (urlDatabase[shortUrl].userID !== userId) {
    res.sendStatus(403);
  } else {
    let templateVars = {
      shortUrl: shortUrl,
      url: urlDatabase[shortUrl].url,
      user: users[userId].email
    };
    res.render("urls_show", templateVars);
  }
});

app.get("/urls/new", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.redirect("/login");
  } else {
    let templateVars = {
      user: users[userId].email
    };
    res.render("urls_new", templateVars);
  }
});

app.get("/u/:shortURL", (req,res) => {
  // let longURL = ...
  let shortUrl = req.params.shortURL;
  if(!urlDatabase[shortUrl]) {
    res.sendStatus(404);
  } else {
    res.redirect(urlDatabase[shortUrl].url);
  }
});

app.get("/register", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.render("register", { errMsg: "" });
  } else {
    res.redirect("/urls");
  }
});

app.get("/login", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.render("login", {});
  } else {
    res.redirect("/urls");
  }
});

app.post("/urls/:id/delete", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.sendStatus(401);
  } else {
    let shortUrl = req.params.id;
    if (!urlDatabase[shortUrl]) {
      res.sendStatus(400);
    } else if (req.session.user_id === urlDatabase[shortUrl].userID) {
      delete urlDatabase[req.params.id];
      res.redirect("/urls");
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/urls/:id", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.sendStatus(401);
  } else {
    if (req.session.user_id === urlDatabase[req.params.id].userID) {
      urlDatabase[req.params.id].url = req.body.newURL;
      res.redirect("/urls");
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/urls", (req, res) => {
  let userId = req.session.user_id;
  if(!userId || !users[userId]) {
    res.sendStatus(401);
  } else {
    let shortURL = addUrl(req.body.longURL, userId);
    res.redirect(`/urls/${shortURL}`);
  }
});

app.post("/login", (req, res) => {
  if (!req.body.email || !req.body.password) {
    res.sendStatus(400);
  } else {
    let userId = findUser(req.body.email, req.body.password);
    if (!userId) {
      res.sendStatus(403);
    } else {
      req.session.user_id = userId;
      res.redirect("/urls");
    }
  }
});

app.post("/logout", (req, res) => {
  req.session.user_id = null;
  res.redirect("/urls");
});

app.post("/register", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  if (!email || !password) {
    res.sendStatus(400);
  } else {
    if (canRegistered(email)) {
      let userId = addUser(email, password);
      req.session.user_id = userId;
      res.redirect("/urls");
    } else {
      res.render("register", { errMsg: `${email} had already been registered.` });
    }
  }
});

app.listen(PORT, () => {
  console.log(`TinyApp listening on port ${PORT}!`);
});