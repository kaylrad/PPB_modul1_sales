import express from "express";
import { CustomerController } from "../controllers/customerController.js";

const router = express.Router();

router.get("/", CustomerController.getAll);
router.get("/:id", CustomerController.getById);
router.post("/", CustomerController.create);
router.put("/:id", CustomerController.update);
router.delete("/:id", CustomerController.remove);

export default router;
