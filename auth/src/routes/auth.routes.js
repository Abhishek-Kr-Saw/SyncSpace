import { Router } from 'express';
import passport from 'passport';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';


const router = Router();


router.get('/google', passport.authenticate('google', { 
    session: false,
    scope: [ 'profile', 'email' ]
}));


router.get('/google/callback', passport.authenticate('google', {
    session: false,
    failureRedirect: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}?error=auth_failed` : 'http://localhost:5173?error=auth_failed'
}), async (req, res) => {
    try {
        const { id, displayName, emails, photos } = req.user;
        let user = await User.findOne({ googleId: id });



        if (!user) {
            user = new User({
                googleId: id,
                email: emails[ 0 ].value,
                name: displayName,
                avatar: photos[ 0 ].value
            });
            await user.save();
        }

        // await sendAuthNotification({
        //     userId: user._id,
        //     action: 'google_login',
        //     timestamp: new Date(),
        //     email: emails[ 0 ].value
        // })

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const isProduction = process.env.NODE_ENV === 'production';
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';

        // Set token in cookie
        res.cookie('token', token, {
            httpOnly: true,           // JS can't read it — XSS protection
            secure: isProduction,     // only sent over HTTPS in production
            sameSite: isProduction ? 'none' : 'lax', // allow cross-site in production
            maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
            ...(isProduction && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
        });
        res.redirect(frontendURL); // Redirect to your frontend after successful login
    } catch (err) {
        console.error('Error during Google authentication:', err);
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendURL}?error=auth_failed`); // Redirect to your frontend on error
    }
});


export default router;