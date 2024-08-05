import { check } from "k6";
import http from "k6/http";

export const options = {
  vus: 100,
  duration: "5s",
};

export default function () {
  const res = http.get("http://localhost:3000/count");
  check(res, {
    "is status 200": (r) => r.status === 200,
  });
}
