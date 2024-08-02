import { check } from "k6";
import http from "k6/http";

export default function () {
  const res = http.post("http://localhost/actions/yolo", {
    value: "yolo",
  });
  check(res, {
    "is status 200": (r) => r.status === 200,
  });
}
