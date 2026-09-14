import express from "express";
import { CategoryController } from "../controllers/categoryController.js";

const router = express.Router();

router.post("/", CategoryController.create);
router.get("/", CategoryController.getAll);
router.get("/:id", CategoryController.getById);
router.put("/:id", CategoryController.update);
router.delete("/:id", CategoryController.remove);

export default router;