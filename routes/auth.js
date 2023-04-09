const express = require("express");
const router = express.Router();
const ObjectId = require("mongodb").ObjectId;
const res_Status = false;
const nodemailer = require("nodemailer");

//For latest mongoose version ^7.0.2
// const ObjectId = require('mongoose').Types.ObjectId;

const User = require("../models/user_Model_Updated");

//To Validate User-Inputs
const { body, validationResult } = require("express-validator");

//To Encrypt Passwords
const bcrypt = require("bcryptjs");

//To Generate tokens on user-login
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

//-------------------------------------ROUTES----------------------------

//ROUTE-1: "register" user
router.post(
  "/register",
  //Adding validation for the input fields
  [
    body("name", "Enter Valid Name").isLength({ min: 3 }),
    body("email", "Enter Valid Email").isEmail(),
    body("mobile", "Phone Number must be of 10 digits only")
      .isMobilePhone()
      .isLength({
        min: 10,
        max: 10,
      }),
    body("password", "Password must be of minimun 5 characters").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ res_Status, error: errors.array()[0].msg });
    }
    const { name, email, mobile, password } = req.body;

    try {
      const oldUser = await User.findOne({ email }, { _id: 0, email: 1 });

      if (oldUser) {
        return res.status(400).json({
          res_Status,
          error: "User Already Exists with this email",
        });
      }
      const salt = await bcrypt.genSalt(10);
      const encryptedPassword = await bcrypt.hash(password, salt);
      await User.create({
        name,
        email,
        mobile,
        password: encryptedPassword,
      });
      res.status(200).json({ res_Status: true, message: "User Registered" });
    } catch (error) {
      // console.log(error);
      res.status(500).json({
        res_Status,
        error: "Couldn't sign up\nSOMETHING WENT WRONG\nInternal Server Error",
        message: error.message,
      });
    }
  }
);

//ROUTE-2: "login" user
router.post(
  "/login",
  [
    body("email", "Enter Valid Email").isEmail(),
    body("password", "Password must be of minimun 5 characters").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ res_Status, error: errors.array()[0].msg });
    }
    const { email, password } = req.body;

    const user = await User.findOne({ email }, { _id: 1, password: 1 });

    if (!user) {
      return res.status(400).json({
        res_Status,
        error: "User Not Found \nGet yourself Registered first",
      });
    }
    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET);
      // console.log(token);

      if (res.status(201)) {
        return res.json({
          res_Status: true,
          authtoken: token,
          message: "Successfully Logged In",
        });
      } else {
        return res.json({
          res_Status,
          error: "Some Error Ocurred\nTry Again",
        });
      }
    }
    res.json({ res_Status, error: "Invalid Password" });
  }
);

//ROUTE-3:Get logged-in user "userData"
router.post("/userData", async (req, res) => {
  const { token } = req.body;
  try {
    // console.log(token);
    // console.log(user);

    const _id = jwt.verify(token, JWT_SECRET)._id;
    User.findOne({ _id: new ObjectId(_id) })
      .then((data) => {
        res.send({ status: "ok", data: data });
      })
      .catch((error) => {
        res.send({ status: "ok", data: error });
      });
  } catch (error) {
    res.send({ status: "Failed", data: error.message });
  }
});

//ROUTE-4:Add Expense for any day
router.post(
  "/add_User_Expense_Daily",
  [
    body("field", "Expense Type Cannot be Empty").not().isEmpty().isLength({
      min: 1,
    }),
    body("value", "Expense Value Cannot be Empty").not().isEmpty().isLength({
      min: 1,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: errors.array()[0].msg, message: errors.array()[0].msg });
    }
    try {
      const { token, year, month, day, field, value, info } = req.body;
      const _id = jwt.verify(token, JWT_SECRET)._id;
      User.findOne(
        {
          _id: new ObjectId(_id),
          details: { $elemMatch: { year: year, month: month, day: day } },
        },
        async (err, user) => {
          // console.log("2");
          // console.log(user);

          if (user) {
            // console.log("3");
            // console.log(user._id);
            User.updateOne(
              {
                _id: _id,
                details: { $elemMatch: { year: year, month: month, day: day } },
              },
              {
                $push: {
                  "details.$.expense": { type: field, val: value, info: info },
                },
              },
              async (error, ans) => {
                if (error) res.send(error);
                else {
                  // console.log(ans);
                  if (ans.modifiedCount === 1) {
                    res.send({ message: "Successfully Added", ans });
                  }
                }
              }
            );
          } else {
            // console.log("4");
            User.updateOne(
              { _id: _id },
              {
                $push: {
                  details: {
                    year: year,
                    month: month,
                    day: day,
                    expense: [{ type: field, val: value, info: info }],
                  },
                },
              },
              async (error, ans) => {
                if (error) res.send(error);
                else {
                  // console.log("5");
                  if (ans.modifiedCount === 1) {
                    res.send({ message: "successfully stored", ans });
                  }
                }
              }
            );
          }
        }
      );
    } catch (error) {
      // console.log(error);
      res.send({ error: error.message });
    }
  }
);

//ROUTE-5:Fetch total expense for a day
router.post("/fetch_User_Expense_Sum_Daily", async (req, res) => {
  try {
    const { token, year, month, day } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;
    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      {
        $match: {
          "details.year": year,
          "details.month": month,
          "details.day": day,
        },
      },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.day",
          sum: { $sum: "$details.expense.val" },
        },
      },
    ]).exec((err, daily_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(daily_Expense);
      }
    });
  } catch (error) {
    // console.log(err);
    res.send({ error: error.message });
  }
});

//ROUTE-6:Fetch total expense for a month
router.post("/fetch_User_Expense_Sum_Monthly", async (req, res) => {
  try {
    const { token, year, month } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;
    // console.log(_id);

    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year, "details.month": month } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.month",
          sum: { $sum: "$details.expense.val" },
        },
      },
    ]).exec((err, monthly_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(monthly_Expense);
      }
    });
  } catch (error) {
    // console.log(err);
    res.send({ error: error.message });
  }
});

//ROUTE-7:Fetch total expense for a year
router.post("/fetch_User_Expense_Sum_Yearly", async (req, res) => {
  try {
    const { token, year } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;

    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.year",
          sum: { $sum: "$details.expense.val" },
        },
      },
    ]).exec((err, yearly_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(yearly_Expense);
      }
    });
  } catch (error) {
    // console.log(error);
    res.send({ error: error.message });
  }
});

//ROUTE-8:Fetch all expense details for a given day
router.post("/fetch_User_Expense_Details_Daily", async (req, res) => {
  try {
    const { token, year, month, day } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;

    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      {
        $match: {
          "details.year": year,
          "details.month": month,
          "details.day": day,
        },
      },
      {
        $project: {
          _id: 0,
          "details.day": 1,
          "details.expense": 1,
          "details._id": 1,
        },
      },
    ]).exec((err, daily_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(daily_Expense);
      }
    });
  } catch (error) {
    // console.log(error);
    res.send({ error: error.message });
  }
});

//ROUTE-9:Fetch day-wise expense for a given month
router.post("/fetch_User_Expense_Details_Monthly", async (req, res) => {
  try {
    const { token, year, month } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;
    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year, "details.month": month } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.day",
          sum: { $sum: "$details.expense.val" },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec((err, monthly_Expense) => {
      if (err) {
        console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(monthly_Expense);
      }
    });
    // .toArray((error, ans) => {
    //   if (error) res.send({ error: error.message });
    //   if (ans.length) {
    //     res.json(ans);
    //   } else res.send({ data: "no doc found" });
    // });
  } catch (error) {
    // console.log(error);
    res.send({ error: error.message });
  }
});

//ROUTE-10:Fetch month-wise expense for a given year
router.post("/fetch_User_Expense_Details_Yearly", async (req, res) => {
  try {
    const { token, year } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;
    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.month",
          sum: { $sum: "$details.expense.val" },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec((err, yearly_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(yearly_Expense);
      }
    });
  } catch (err) {
    res.send(err);
    // console.log(err);
  }
});

//ROUTE-11:Fetch Type-Wise expense for a month
router.post("/fetch_User_Expense_TypeWise_Monthly", async (req, res) => {
  try {
    const { token, year, month } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;

    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year, "details.month": month } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.expense.type",
          sum: { $sum: "$details.expense.val" },
        },
      },
    ]).exec((err, monthly_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(monthly_Expense);
      }
    });
  } catch (error) {
    // console.log(error);
    res.send({ error: error.message });
  }
});

//ROUTE-12:Fetch Type-Wise expense  for a year
router.post("/fetch_User_Expense_TypeWise_Yearly", async (req, res) => {
  try {
    const { token, year } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;

    const f = User.aggregate([
      { $match: { _id: new ObjectId(_id) } },
      { $unwind: "$details" },
      { $match: { "details.year": year } },
      { $unwind: "$details.expense" },
      {
        $group: {
          _id: "$details.expense.type",
          sum: { $sum: "$details.expense.val" },
        },
      },
    ]).exec((err, yearly_Expense) => {
      if (err) {
        // console.log(err);
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify({ message: "Failure" }));
        res.sendStatus(500);
      } else {
        res.send(yearly_Expense);
      }
    });
  } catch (err) {
    res.send(err.message);
    console.log(err);
  }
});

//ROUTE-13:Update any particular Expense for any day
router.post(
  "/update_Any_User_Expense_",
  [
    body("new_field", "Expense Type Cannot be Empty").not().isEmpty(),
    body("new_value", "Expense Value Cannot be Empty")
      .not()
      .isEmpty()
      .isLength({
        min: 1,
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: errors.array()[0].msg, message: errors.array()[0].msg });
    }
    try {
      const { token, date_id, expense_id, new_field, new_value, new_info } =
        req.body;
      // console.log(req.body);
      const _id = jwt.verify(token, JWT_SECRET)._id;
      console.log(_id);

      User.updateOne(
        {
          _id: new ObjectId(_id),
        },
        {
          $set: {
            "details.$[i].expense.$[j].val": new_value,
            "details.$[i].expense.$[j].type": new_field,
            "details.$[i].expense.$[j].info": new_info,
          },
        },
        {
          arrayFilters: [
            { "i._id": new ObjectId(date_id) },
            { "j._id": new ObjectId(expense_id) },
          ],
        },
        async (error, ans) => {
          if (error) res.send(error);
          else {
            // console.log(ans);
            if (ans.modifiedCount === 1) {
              res.send({ message: "successfully stored", ans });
            } else {
              if (ans.matchedCount === 1) {
                res.send({
                  message: "Kindly Provide Updated Expense Details",
                  ans,
                });
              } else {
                res.send({ message: "Could not update", ans });
              }
            }
          }
        }
      );
    } catch (error) {
      // console.log(error);
      res.send({
        message: "Some Error Occured\nExpense not updated",
        error: error.message,
      });
    }
  }
);

//ROUTE-14:Delete Expense for any day
router.post("/delete_User_Expense", async (req, res) => {
  try {
    const { token, date_id, expense_id } = req.body;
    const _id = jwt.verify(token, JWT_SECRET)._id;
    // console.log(_id);
    User.updateOne(
      {
        _id: new ObjectId(_id),
      },
      {
        $pull: {
          "details.$[i].expense": { _id: expense_id },
        },
      },
      {
        arrayFilters: [{ "i._id": new ObjectId(date_id) }],
      },
      async (error, ans) => {
        if (error)
          res.send({ message: "Could not Delete", error: error.message });
        else {
          if (ans.modifiedCount === 1) {
            res.send({ message: "Successfully Deleted", ans });
          } else {
            res.send({
              message:
                "Could not Delete \n No Expense Available for the provided data",
              ans,
            });
          }
        }
      }
    );
  } catch (error) {
    // console.log(error);
    res.send({ error: error.message });
  }
});

//ROUTE-15:Verify User Password
router.post(
  "/verify_User_Password",
  [
    body("password", "Password must be of minimun 5 characters").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ status: 400, error: errors.array()[0].msg });
      }

      const { token, password } = req.body;
      const _id = jwt.verify(token, JWT_SECRET)._id;
      // console.log(req.body);
      // console.log(_id);

      const user = await User.findOne(
        { _id: new ObjectId(_id) },
        { _id: 0, password: 1 }
      );

      if (await bcrypt.compare(password, user.password)) {
        return res.json({
          status: 201,
          message: "Correct Password",
        });
      } else {
        return res.json({
          status: 400,
          message: "Incorrect Password",
        });
      }
    } catch (error) {
      res.send({ status: 400, error: error.message });
      // console.log(error);
    }
  }
);

//ROUTE-16:Update User Password
router.post(
  "/update_User_Password",
  [
    body("new_Password", "Password must be of minimun 5 characters").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ status: 400, error: errors.array()[0].msg });
      }

      const { token, new_Password } = req.body;
      const _id = jwt.verify(token, JWT_SECRET)._id;
      // console.log(req.body);
      // console.log(_id);

      const user = await User.findOne(
        { _id: new ObjectId(_id) },
        { _id: 0, password: 1 }
      );

      if (await bcrypt.compare(new_Password, user.password)) {
        return res.json({
          status: 201,
          message:
            "New Password and current password cannot be same\nEnter new password",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const encryptedPassword = await bcrypt.hash(new_Password, salt);

      User.updateOne(
        {
          _id: new ObjectId(_id),
        },
        {
          password: encryptedPassword,
        },
        async (error, ans) => {
          if (error)
            res.send({
              message: "Could not Upadte Password",
              error: error.message,
            });
          else {
            if (ans.modifiedCount === 1) {
              res.send({ message: "Password Updated Successfully", ans });
            } else {
              res.send({
                message: "Could not Update Password\nSome Error Occured",
                ans,
              });
            }
          }
        }
      );
    } catch (error) {
      res.send({ error: error.message });
      // console.log(error);
    }
  }
);

//ROUTE-17:Fetch User Profile Details
router.post("/fetch_User_Profile_Details", async (req, res) => {
  const { token } = req.body;
  try {
    const _id = jwt.verify(token, JWT_SECRET)._id;
    // console.log(token);
    // console.log(user);

    User.findOne(
      { _id: new ObjectId(_id) },
      { _id: 0, name: 1, email: 1, mobile: 1, prof_Pic: 1 }
    )
      .then((data) => {
        res.status(200).json({ message: "ok", data: data });
      })
      .catch((error) => {
        res.status(400).json({ message: "Error", data: error });
      });
  } catch (error) {
    res.send({ message: "Some Internal Server Error", data: error.message });
  }
});

//ROUTE-18:Update User Profile Details
router.post(
  "/update_User_Profile_Details",
  [
    body("name", "Enter Valid Name").isLength({ min: 3 }),
    body("email", "Enter Valid Email").isEmail(),
    body("mobile", "Phone Number must be of 10 digits only")
      .isMobilePhone()
      .isLength({
        min: 10,
        max: 10,
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: errors.array()[0].msg, error: errors.array()[0].msg });
    }
    try {
      const { token, name, email, mobile, prof_Pic } = req.body;
      const _id = jwt.verify(token, JWT_SECRET)._id;

      const user = await User.findOne(
        {
          email: email,
        },
        { _id: 1, email: 1 }
      );
      if (user) {
        //Check if new-email is registered with some other user
        if (user._id.toString() !== _id) {
          // console.log(user._id.toString() !== _id);
          // console.log(typeof _id);
          // console.log(typeof user._id.toString());
          // console.log(user._id.toString());
          // console.log(_id);

          return res.status(400).json({
            status: 400,
            message: "Some Other User Already Exists with this email",
          });
        }
      }

      const user2 = await User.findOne(
        {
          mobile: mobile,
        },
        { _id: 1, mobile: 1 }
      );
      if (user2) {
        //Check if new-mobile is registered with some other user
        if (user2._id.toString() !== _id) {
          return res.status(400).json({
            status: 400,
            message: "Some Other User Already Exists with this mobile number",
          });
        }
      }

      User.updateOne(
        {
          _id: new ObjectId(_id),
        },
        {
          name: name,
          email: email,
          mobile: mobile,
          prof_Pic: prof_Pic,
        },
        async (error, ans) => {
          if (error) res.send(error);
          else {
            if (ans.modifiedCount === 1) {
              res.send({ message: "Successfully Updated", ans });
            } else {
              if (ans.matchedCount === 1) {
                res.send({
                  message: "Kindly Provide Updated Details",
                  ans,
                });
              } else {
                res.send({
                  message:
                    "Details Could not be Updated\nSome technical error occurred",
                  ans,
                });
              }
            }
          }
        }
      );
    } catch (error) {
      return res.json({
        message: "Details Could not be Updated\nSome technical error occurred",
        error: error.message,
      });
    }
  }
);

//ROUTE-19:Add Expense_Type for the user
router.post(
  "/add_User_Expense_Type",
  [
    body("expense_Type", "Expense Type Cannot be Empty").isLength({
      min: 1,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: errors.array()[0].msg, error: errors.array()[0].msg });
    }
    try {
      const { token, expense_Type } = req.body;
      const _id = jwt.verify(token, JWT_SECRET)._id;

      User.findOne(
        {
          _id: new ObjectId(_id),
          expense_Type_List: { $elemMatch: { expense_Type: expense_Type } },
        },
        async (err, user) => {
          if (user) {
            res
              .status(400)
              .json({ message: "This Expense Type Already Exists" });
          } else {
            User.updateOne(
              {
                _id: _id,
              },
              {
                $push: {
                  expense_Type_List: { expense_Type: expense_Type },
                },
              },
              async (error, ans) => {
                if (error)
                  res.status(400).json({
                    message: "Could not add due to some error",
                    error: error.msg,
                  });
                else {
                  if (ans.modifiedCount === 1) {
                    res.status(200).json({
                      message: "New Expense Type Successfully Added",
                      ans,
                    });
                  } else {
                    res
                      .status(400)
                      .json({ message: "Could not add due to some error" });
                  }
                }
              }
            );
          }
        }
      );
    } catch (error) {
      res.status(400).json({
        message:
          "Expense Type Could not be Updated\nSome technical error occurred",
        error: error.message,
      });
    }
  }
);

//ROUTE-20:Fetch User Expense Types
router.post("/fetch_User_Expense_Types", async (req, res) => {
  const { token } = req.body;
  try {
    const _id = jwt.verify(token, JWT_SECRET)._id;

    User.findOne(
      { _id: new ObjectId(_id) },
      { _id: 0, "expense_Type_List.expense_Type": 1 }
    )
      .then((data) => {
        res.status(200).json({ message: "ok", data: data });
      })
      .catch((error) => {
        res.status(400).json({ message: "Error", data: error.message });
      });
  } catch (error) {
    res.send({ message: "Some Internal Server Error", data: error.message });
  }
});

//Route-21:OTP generation - Forgotten Password Feature
router.post(
  "/mail_OTP_Forgotten_Password",
  [body("email", "Enter Valid Email").isEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Error",
        data: errors.array()[0].msg,
      });
    }
    try {
      const { email } = req.body;

      User.findOne({ email: email }, async (err, user) => {
        if (user) {
          const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
          const salt = await bcrypt.genSalt(10);
          const encryptedOTP = await bcrypt.hash(otp, salt);
          const msg = {
            from: process.env.coinBook_Email_ID,
            to: email,
            subject: `CoinBook account recovery code`,
            // text: "Tui ekta naj",
            html: `
          <p>
            Hiii ${email},
            <br><br>
            We received a request to reset your CoinBook account's password.
            <br><br>
            Enter the following password reset code:
            <br><br>
            <b>${otp}</b>
          </p>`,
          };
          nodemailer
            .createTransport({
              service: "gmail",
              auth: {
                user: process.env.coinBook_Email_ID,
                pass: process.env.coinBook_Email_Pass,
              },
              port: 465,
              host: "smtp.ethereal.email",
            })
            .sendMail(msg, (error) => {
              if (error) {
                res.status(400).json({ message: "Error", data: error.message });
              } else {
                // console.log(msg);
                User.updateOne(
                  {
                    email: email,
                  },
                  { $set: { otp: encryptedOTP } },
                  async (error, ans) => {
                    if (error) {
                      res
                        .status(400)
                        .json({ message: "Error", data: error.message });
                    } else {
                      if (ans.modifiedCount === 1) {
                        const token = jwt.sign(
                          { email: user.email },
                          JWT_SECRET
                        );
                        res.status(200).json({
                          message: "ok",
                          data: "Password Reset Code Successfully Sent to your Email ",
                          token: token,
                        });
                      } else
                        res.status(400).json({
                          message: "Error",
                          data: "Some Internal problem occured\nTry Again",
                        });
                    }
                  }
                );
              }
            });
        } else {
          res.status(400).json({
            message: "Error",
            data: "This Email is not yet registered with CoinBook",
          });
        }
      });
    } catch (error) {
      res.status(400).json({ message: "Error", data: error.message });
    }
  }
);

//ROUTE-22:Verify User OTP - Forgotten Password Feature
router.post(
  "/verify_User_OTP_Forgotten_Password",
  [
    body("otp", "OTP Code must be of exactly 4 characters").isLength({
      min: 4,
      max: 4,
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ message: "Error", data: errors.array()[0].msg });
      }
      const { token, otp } = req.body;
      const email = jwt.verify(token, JWT_SECRET).email;

      const user = await User.findOne({ email: email }, { _id: 0, otp: 1 });

      if (!user) {
        return res.status(400).json({
          message: "Error",
          data: "This Email is not yet registered with CoinBook",
        });
      }
      if (await bcrypt.compare(otp, user.otp)) {
        return res.status(200).json({
          message: "ok",
          data: "OTP verified successfully",
          token: token,
        });
      } else {
        return res.status(400).json({
          message: "Error",
          data: "Incorrect OTP",
        });
      }
    } catch (error) {
      res.status(400).send({ message: "Error", data: error.message });
    }
  }
);

//ROUTE-23:Update User Password - Forgotten Password Feature
router.post(
  "/update_User_Password_Forgotten_Password",
  [
    body("new_Password", "Password must be of minimun 5 characters").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ message: "Error", data: errors.array()[0].msg });
      }

      const { token, new_Password } = req.body;
      const email = jwt.verify(token, JWT_SECRET).email;

      const user = await User.findOne(
        { email: email },
        { _id: 0, password: 1 }
      );

      if (await bcrypt.compare(new_Password, user.password)) {
        return res.status(400).json({
          message: "Error",
          data: "New Password and current password cannot be same\nEnter new password",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const encryptedPassword = await bcrypt.hash(new_Password, salt);

      User.updateOne(
        { email: email },
        {
          password: encryptedPassword,
        },
        async (error, ans) => {
          if (error)
            res.status(400).send({
              message: "Could not Update Password",
              data: error.message,
            });
          else {
            if (ans.modifiedCount === 1) {
              res.status(200).send({
                message: "ok",
                data: "Password Updated Successfully",
                ans,
              });
            } else {
              res.status(400).send({
                message: "Error",
                data: "Could not Update Password\nSome Error Occured",
              });
            }
          }
        }
      );
    } catch (error) {
      res.status(400).send({ message: "Error", data: error.message });
      // console.log(error);
    }
  }
);

//Using .exec/callback to solve toArray() function issue

module.exports = router;
