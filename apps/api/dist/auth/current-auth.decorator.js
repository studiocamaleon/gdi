"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentSession = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentSession = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.auth;
});
//# sourceMappingURL=current-auth.decorator.js.map