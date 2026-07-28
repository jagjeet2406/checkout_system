const express = require("express");
const router = express.Router();
const User = require("../module/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

router.post("/google-login", async (req, res) => {
    try {
        const { name, email, photo, uid } = req.body;

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            // New user — save to MongoDB
            const hashedPassword = await bcrypt.hash(uid, 11); // use uid as dummy password
            user = new User({
                name,
                email,
                password: hashedPassword,
                photo,
                uid,
                loginType: "google"
            });
            await user.save();
            console.log("New Google user saved:", email);
        } else {
            console.log("Existing Google user logged in:", email);
        }

        const token = jwt.sign({ id: user._id }, process.env.SECRET, { expiresIn: "1d" });
        res.json({ success: true, token, user: { name: user.name, email: user.email } });

    } catch (err) {
        console.error("Google login error:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});


router.post("/signup",async (req,res)=>{
    try{
        const {name,email,password} = req.body;
        const exist =  await User.findOne({email:email});
        if (exist) return res.status(400).json({message:"user already exist "});
        const hashpassword = await bcrypt.hash(password,11);
    
        const user = new User ({name,email,password:hashpassword});
        await user.save();
        res.status(201).json({ message: "User created successfully" });
    }
    catch(err){
        res.status(500).json({message:"server error" + err.message});

    }

});

router.post("/login",async(req,res)=>{
    try{
        const{email,password} = req.body;
        // Replace your old User.findOne with this in your /login route:
const user = await User.findOne({
  $or: [
    { email: email.toLowerCase() },
    { name: email } // This checks if they typed their name instead
  ]
});

        if (!user) return res.status(400).json({message:"user not found"});

        const match  = await bcrypt.compare(password,user.password);
        if (!match) return res.status(400).json({message:"wrong password"});
        const token = jwt.sign({id:user._id},process.env.SECRET,{expiresIn:"1d"});
        res.json({token,user:{name:user.name,email:user.email}})

    }
    catch(err){
        res.status(500).json({message:"error" + err.message});

    }

});
module.exports = router;