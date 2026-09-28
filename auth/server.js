import app from './src/app.js';
import {connectToDB} from './src/config/db.js'


connectToDB();

app.listen(3000, () => {
    console.log('Auth server is running on port 3000')
})