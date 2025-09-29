import { Router } from "express";
import UserController from "../controllers/UserController.mjs";

const router = Router();
router.post('/user/create',UserController.create);
router.get('/user/get',UserController.get);
export default router;