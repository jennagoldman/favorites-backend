// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const request = require('superagent');
// Database Client
const client = require('./lib/client');
// Services

// Auth
const ensureAuth = require('./lib/auth/ensure-auth');
const createAuthRoutes = require('./lib/auth/create-auth-routes');
const authRoutes = createAuthRoutes({
    async selectUser(email) {
        const result = await client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `, [email]);
        return result.rows[0];
    },
    async insertUser(user, hash) {
        console.log(user);
        const result = await client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email
        `, [user.email, hash]);
        return result.rows[0];
    }
});

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
app.use(express.urlencoded({ extended: true }));

// setup authentication routes
app.use('/api/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// get search results
app.get('/api/beers', async(req, res) => {
    const data = await request.get(`https://sandbox-api.brewerydb.com/v2/search?key=${process.env.API_KEY}&type=beer&q=${req.query.search}`);

    res.json(data.body);
});

// get favorites

app.get('/api/my/favorites', async(req, res) => {
    try {
        const myQuery = `
            SELECT * 
            FROM favorites 
            WHERE user_id = $1 
        `;
        const favorites = await client.query(myQuery, [req.userId]);

        res.json(favorites.rows);
    }
    catch (err) {
        console.error(err);
    }
});

// add to favorites
app.post('/api/my/favorites', async(req, res) => {
    try {
        const {
            name,
            abv,
            ibu,
            style,
            image_url
        } = req.body;

        const newFavorites = await client.query(`
            INSERT INTO favorites (name, abv, ibu, style, image_url, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, 
        [name, abv, ibu, style, image_url, req.userId]);
        res.json(newFavorites.rows[0]);
    }
    catch (err) {
        console.error(err);
    }
});

app.delete('/api/my/favorites/:id', async(req, res) => {
    try {
        const myQuery = `
            DELETE 
            FROM favorites 
            WHERE id = $1 
        `;
        const favorites = await client.query(myQuery, [req.params.id]);

        res.json(favorites.rows);
    }
    catch (err) {
        console.error(err);
    }
});


// Start the server
app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});