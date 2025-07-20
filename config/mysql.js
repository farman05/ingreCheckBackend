const { read, update, create, execute, startTransaction, rollbackTransaction, commitTransaction, getSingleConnection, releaseSingleConnection, initConnection } = require('mysql-helper-kit');

const config = {
    host: process.env.MYSQL_HOST ,
    port: 3306, // Your MySQL port
    database: process.env.MYSQL_DATABASE,
    password: process.env.MYSQL_PASSWORD,
    user: process.env.MYSQL_USER,
    // Other optional configuration parameters
};

initConnection(config);

module.exports = { read, update, create, execute, startTransaction, rollbackTransaction, commitTransaction, getSingleConnection, releaseSingleConnection };