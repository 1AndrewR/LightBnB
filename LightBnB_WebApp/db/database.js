const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = async function (email) {
  try {
    const query = `SELECT * FROM users WHERE email = $1 LIMIT 1;`;
    const result = await pool.query(query, [email.toLowerCase()]);
    return result.rows[0] || null;
  } catch (err) {
    console.error("Error fetching user by email:", err.message);
    throw err;
  }
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = async function (id) {
  try {
    const query = `SELECT * FROM users WHERE id = $1;`;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error("Error fetching user by ID:", err.message);
    throw err;
  }
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = async function (user) {
  try {
    const query = `
      INSERT INTO users (name, email, password) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const result = await pool.query(query, [user.name, user.email, user.password]);
    return result.rows[0];
  } catch (err) {
    console.error("Error adding user:", err.message);
    throw err;
  }
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @param {number} limit The number of results to return.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = async function (guest_id, limit = 10) {
  try {
    const query = `
      SELECT reservations.*, properties.*, avg(property_reviews.rating) as average_rating
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      JOIN property_reviews ON properties.id = property_reviews.property_id
      WHERE reservations.guest_id = $1
      GROUP BY reservations.id, properties.id
      ORDER BY reservations.start_date DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [guest_id, limit]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching reservations:", err.message);
    throw err;
  }
};

/// Properties

/**
 * Get all properties with optional filters.
 * @param {{}} options An object containing query options.
 * @param {number} limit The number of results to return.
 * @return {Promise<[{}]>} A promise to the properties.
 */
const getAllProperties = async function (options, limit = 10) {
  try {
    const queryParams = [];
    let queryString = `
      SELECT properties.*, avg(property_reviews.rating) as average_rating
      FROM properties
      LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
    `;

    const whereClauses = [];

    if (options.city) {
      queryParams.push(`%${options.city}%`);
      whereClauses.push(`city LIKE $${queryParams.length}`);
    }

    if (options.owner_id) {
      queryParams.push(options.owner_id);
      whereClauses.push(`owner_id = $${queryParams.length}`);
    }

    if (options.minimum_price_per_night && options.maximum_price_per_night) {
      queryParams.push(options.minimum_price_per_night * 100, options.maximum_price_per_night * 100);
      whereClauses.push(`cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`);
    } else if (options.minimum_price_per_night) {
      queryParams.push(options.minimum_price_per_night * 100);
      whereClauses.push(`cost_per_night >= $${queryParams.length}`);
    } else if (options.maximum_price_per_night) {
      queryParams.push(options.maximum_price_per_night * 100);
      whereClauses.push(`cost_per_night <= $${queryParams.length}`);
    }

    if (options.minimum_rating) {
      queryParams.push(options.minimum_rating);
      whereClauses.push(`avg(property_reviews.rating) >= $${queryParams.length}`);
    }

    if (whereClauses.length > 0) {
      queryString += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    queryParams.push(limit);
    queryString += `
      GROUP BY properties.id
      ORDER BY cost_per_night
      LIMIT $${queryParams.length};
    `;

    const result = await pool.query(queryString, queryParams);
    return result.rows;
  } catch (err) {
    console.error("Error fetching properties:", err.message);
    throw err;
  }
};

/**
 * Add a property to the database.
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = async function (property) {
  try {
    const query = `
      INSERT INTO properties (
        owner_id, title, description, thumbnail_photo_url, cover_photo_url, 
        cost_per_night, street, city, province, post_code, country, 
        parking_spaces, number_of_bathrooms, number_of_bedrooms
      ) 
      VALUES (
        $1, $2, $3, $4, $5, 
        $6, $7, $8, $9, $10, $11, 
        $12, $13, $14
      )
      RETURNING *;
    `;

    const queryParams = [
      property.owner_id,
      property.title,
      property.description,
      property.thumbnail_photo_url,
      property.cover_photo_url,
      property.cost_per_night * 100, // Convert dollars to cents
      property.street,
      property.city,
      property.province,
      property.post_code,
      property.country,
      property.parking_spaces,
      property.number_of_bathrooms,
      property.number_of_bedrooms,
    ];

    const result = await pool.query(query, queryParams);
    return result.rows[0];
  } catch (err) {
    console.error("Error adding property:", err.message);
    throw err;
  }
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
