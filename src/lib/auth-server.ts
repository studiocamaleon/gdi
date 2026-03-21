import { cache } from "react";

import { getCurrentUser } from "@/lib/auth";

export const getCurrentUserCached = cache(getCurrentUser);
