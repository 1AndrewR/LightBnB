const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});

const properties = require("./json/properties.json");
const users = require("./json/users.json");

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1 LIMIT 1;`, [email])
    .then((result) => result.rows[0] || null)
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};


/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [id])
    .then((result) => result.rows[0] || null)
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  return pool
    .query(
      `INSERT INTO users (name, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING *;`,
      [user.name, user.email, user.password]
    )
    .then((result) => result.rows[0])
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  return pool
    .query(
      `SELECT reservations.*, properties.*, avg(property_reviews.rating) as average_rating
       FROM reservations
       JOIN properties ON reservations.property_id = properties.id
       LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
       WHERE reservations.guest_id = $1
       GROUP BY reservations.id, properties.id
       ORDER BY reservations.start_date DESC
       LIMIT $2;`,
      [guest_id, limit]
    )
    .then((result) => result.rows)
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function (options, limit = 10) {
  const queryParams = [];
  let queryString = `
    SELECT properties.*, 
           AVG(property_reviews.rating) AS average_rating
    FROM properties
    LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  const whereClauses = [];

  // Filter by city
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    whereClauses.push(`city LIKE $${queryParams.length}`);
  }

  // Filter by owner_id
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    whereClauses.push(`owner_id = $${queryParams.length}`);
  }

  // Filter by price range (handle both min and max together)
  if (options.minimum_price_per_night !== undefined && options.maximum_price_per_night !== undefined) {
    queryParams.push(options.minimum_price_per_night * 100, options.maximum_price_per_night * 100);
    whereClauses.push(`cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`);
  } else if (options.minimum_price_per_night !== undefined) {
    queryParams.push(options.minimum_price_per_night * 100);
    whereClauses.push(`cost_per_night >= $${queryParams.length}`);
  } else if (options.maximum_price_per_night !== undefined) {
    queryParams.push(options.maximum_price_per_night * 100);
    whereClauses.push(`cost_per_night <= $${queryParams.length}`);
  }

  // Apply WHERE clause if any filters exist
  if (whereClauses.length > 0) {
    queryString += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  // Group by property ID and filter by minimum rating
  queryString += `
    GROUP BY properties.id
  `;

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` HAVING AVG(property_reviews.rating) >= $${queryParams.length}`;
  }

  // Add order and limit
  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  console.log(queryString, queryParams); // Debugging

  return pool
    .query(queryString, queryParams)
    .then((res) => res.rows)
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};
/**
 * Add a new property to the database.
 * @param {{ owner_id: number, title: string, description: string, thumbnail_photo_url: string, cover_photo_url: string, cost_per_night: number, street: string, city: string, province: string, post_code: string, country: string, parking_spaces: number, number_of_bathrooms: number, number_of_bedrooms: number }} property
 * @return {Promise<{}>} A promise to the added property.
 */
const addProperty = function (property) {
  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night * 100,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms,
  ];

  const queryString = `
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

  return pool
    .query(queryString, queryParams)
    .then((res) => res.rows[0]) 
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};


module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
