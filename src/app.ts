import express, { Express } from "express";
import { Server } from "http";
import { inject, injectable } from "inversify";
import { ILogger } from "./logger/logger.interface";
import { TYPES } from "./types";
import { json } from "body-parser";
import "reflect-metadata";
import cors from "cors";
import { IConfigService } from "./config/config.service.interface";
import { IExeptionFilter } from "./errors/exeption.filter.interface";
import { UserController } from "./users/users.controller";
import { ChatController } from "./chats/chats.controller";
import { MessageController } from "./messages/messages.controller";
import { PrismaService } from "./database/prisma.service";
import { MessageDeletionService } from "./services/messageDeletionService/messageDeletionService";
import { AuthMiddleware } from "./common/auth.middleware";

@injectable()
export class App {
  app: Express;
  server: Server;
  port: number;

  constructor(
    @inject(TYPES.ILogger) private logger: ILogger,
    @inject(TYPES.UserController) private userController: UserController,
    @inject(TYPES.ChatController) private chatController: ChatController,
    @inject(TYPES.MessageController)
    private messageController: MessageController,
    @inject(TYPES.ExeptionFilter) private exeptionFilter: IExeptionFilter,
    @inject(TYPES.ConfigService) private configService: IConfigService,
    @inject(TYPES.PrismaService) private prismaService: PrismaService,
    @inject(TYPES.MessageDeletionService)
    private messageDeletionService: MessageDeletionService
  ) {
    this.app = express();
    this.port = 5000;
  }

  useMiddleware(): void {
    if(this.configService.get("ENV") === "development") {
      this.app.use(cors({ credentials: true, origin: this.configService.get("CORS_DEV_ALLOW")}));
    }
    this.app.use(json());
    const authMiddleware = new AuthMiddleware(this.configService.get("SECRET"));
    this.app.use(authMiddleware.execute.bind(authMiddleware));
  }

  useRoutes(): void {
    this.app.use("/users", this.userController.router);
    this.app.use("/chats", this.chatController.router);
    this.app.use("/messages", this.messageController.router);
  }

  useExeptionFilters(): void {
    this.app.use(this.exeptionFilter.catch.bind(this.exeptionFilter));
  }

  public async init(): Promise<void> {
    this.useMiddleware();
    this.useRoutes();
    this.useExeptionFilters();
    await this.prismaService.connect();
    this.messageDeletionService.init();
    this.server = this.app.listen(this.port);
    this.logger.log(`Server started at http://localhost:${this.port}`);
  }

  public close(): void {
    this.server.close();
  }
}
