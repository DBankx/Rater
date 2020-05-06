// require relevant modules
require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const ejs = require('ejs')
const nodemailer = require('nodemailer')
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')


const app = express()

// setting up middleware
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: true}))

// setup session
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}))

// flash message middleware
app.use(function(req, res, next){
    res.locals.message = req.session.message
    delete req.session.message
    next()
})

// setup passport
app.use(passport.initialize())
app.use(passport.session())


// connect to a mongoDB database
mongoose.connect('mongodb://localhost:27017/raterDB', {useNewUrlParser: true, useUnifiedTopology: true})
mongoose.set('useCreateIndex', true)
mongoose.set('useFindAndModify', false)

// creating a schema for movie ratings
const ratingSchema = new mongoose.Schema({
    name: String,
    url: String,
    rating: {
        type: Number,
        min: 0,
        max: 10
    },
    comment: String
})

// creating a user schema for the users
const userSchema = new mongoose.Schema({
    email: String,
    username: String,
    password: String,
    ratings: [ratingSchema]
})


// plugin passport to the user schema
userSchema.plugin(passportLocalMongoose)

// creating a model for the userSchema
const User = new mongoose.model('User', userSchema)


// strategy for passport
passport.use(User.createStrategy())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())


// for sending email
var transporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    port: 25,
    auth: {
        user: 'loldondo@gmail.com',
        pass: process.env.PASS
    },
    tls: {
        rejectUnauthorized: false
    }
    });


// render home page
app.get('/', function(req, res){
    User.find((err, foundUser)=>{
        if(err){
            console.log(err)
        } else {
            if (foundUser) {
                res.render('home', {usersrating: foundUser, authenticated: req.isAuthenticated(), req: req})
           
            }

        }
    })
})

// post method for home page
app.post('/', function(req, res){
    var searchedName = req.body.search
    User.find(function(err, name){
        if(err){
            console.log(err)
        }
        if(name){
           res.render('homeSearch', {users: name, authenticated: req.isAuthenticated(), req: req, searchedName: searchedName})
        }
    }).elemMatch('ratings', { name: searchedName})

})

// render register page
app.get('/register', function(req, res){
    res.render('register')
})

// post method for register page
app.post('/register', function(req, res){
    User.register({username: req.body.username, email: req.body.userName2}, req.body.password, function(err, user){
        if (err){
            req.session.message = {
                type: 'danger',
                intro: 'Error! ',
                message: 'Oops please try again!'
            }
           res.redirect('register')
        } else {
            passport.authenticate('local')(req, res, function(){
                req.session.message = {
                    type: 'success',
                    intro: '',
                    message: 'you are now registered!'
                }
                res.redirect('ratings')
            })
        }
    })
})

// Login route
app.get('/login', function(req, res){
    res.render('login')
})

// post - login with created credentials
app.post('/login', function(req, res){
    if (req.body.username == '' || req.body.password == ''){
        req.session.message = {
            type: 'danger',
            intro: 'Empty fields! ',
            message: 'Please insert your credentials'
        }
    }
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })
    
    req.login(user, function(err){
        if(err){
            console.log(err || !user)
            req.session.message = {
                type: 'danger',
                intro: 'Error! ',
                message: 'Wrong credentials. Please try again!'
            }
            res.redirect('login')
        } else {
            passport.authenticate('local', {successRedirect: '/ratings', failureRedirect: '/login', failureMessage: req.session.message = {
                type: 'danger',
                intro: 'Error! ',
                message: 'Wrong email or password!'
            }})(req, res, function(){
                res.redirect('ratings')
            })
        }
    })

})

// rendering ratings page
app.get('/ratings', function(req, res){
    if(req.isAuthenticated()){
      res.render('ratings', {user: req.user})
    } else {
        res.redirect('login')
    }
})

app.post('/ratings', function(req, res){
    var newRating = {
        name: req.body.movieName,
        url: req.body.imageUrl,
        rating: req.body.rating,
        comment: req.body.comment
    }
    
    User.findOne({username: req.user.username}, function(err, foundUser){
        if (err){
            console.log(err)
        } else {
            foundUser.ratings.push(newRating)
            foundUser.save()
            res.redirect('/ratings')
        }
    })


})

// creating a delete route
app.post('/delete', function(req, res){
    var checkedId = req.body.check
// checks the database for the current user and deletes the id of the rating from it
    User.findOneAndUpdate(
        {username: req.user.username},
        {$pull: {'ratings': {_id: checkedId}}},
        {new: true},
        function(err){
            if (err){
                console.log(err)
            } else {
                res.redirect('/ratings')
            }
        }
        )
})

// contact page
app.get('/contact', function(req, res){
    res.render('contact', {authenticated: req.isAuthenticated(), req: req})
})

// post emails from contact page
app.post('/contact', function(req, res){
    
    var mailOptions = {
    from: req.body.email,
    to: 'loldondo@gmail.com',
    subject: req.body.subject,
    text: req.body.message
    };

    transporter.sendMail(mailOptions, function(error, info){
    if (error) {
        console.log(error);
    } else {
        console.log('Email sent: ' + info.response);
        res.redirect('/success')
    }
});
})

app.get('/success', function(req, res){
    res.render('success', {authenticated: req.isAuthenticated(), req: req})
})

// logout of app
app.get('/logout', function(req, res){
    req.logout()
    res.redirect('/')
})

// listen to port 3000
app.listen(3000, function(){
    console.log('Server has started on port 3000')
})

