const express = require("express")

const adminRoutes = require("./adminRoute")
const patientRoutes = require("./patientRoute")
const doctorRoutes = require("./doctorRoute")
const apiRoutes = require("./apiRoute")
const viewController = require("../controller/viewController")

const router = express.Router()

router.use("/admin", adminRoutes)
router.use("/patient", patientRoutes)
router.use("/doctor", doctorRoutes)
router.use("/api", apiRoutes)

// Main Welcome Landing Gateway Page
router.get("/", (req, res) => {
  res.render("landing")
})

// Public Landing Subpages
router.get("/clinics", viewController.clinicsPage)
router.get("/doctors", viewController.doctorsPage)
router.get("/services", viewController.servicesPage)
router.get("/about", viewController.aboutPage)
router.get("/contact", viewController.contactPage)

module.exports = router