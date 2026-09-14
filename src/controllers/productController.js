import { ProductModel } from "../models/productModel.js";

export const ProductController = {
  async getAll(req, res) {
    try {
      const products = await ProductModel.getAll();
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req, res) {
    try {
      const product = await ProductModel.getById(req.params.id);
      res.json(product);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  },

  async create(req, res) {
    try {
      const product = await ProductModel.create(req.body);
      res.status(201).json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async update(req, res) {
    try {
      const product = await ProductModel.update(req.params.id, req.body);
      res.json(product);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async remove(req, res) {
    try {
      await ProductModel.remove(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
};