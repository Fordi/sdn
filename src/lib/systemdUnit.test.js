import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSystemdUnit, renderSystemdUnit } from "./systemdUnit.js";

const makeProject = (overrides = {}) => ({
  description: "desc",
  root: "/tmp/project",
  name: "myproject",
  ...overrides,
});

const config = { root: "/repo" };

describe("buildSystemdUnit", () => {
  it("builds Unit, Service, and Install sections with sensible defaults", () => {
    const unit = buildSystemdUnit(makeProject(), config);
    assert.deepEqual(unit.Unit, { Description: "desc", After: ["network.target"] });
    assert.equal(unit.Service.Type, "simple");
    assert.equal(unit.Install.WantedBy[0], "multi-user.target");
  });

  it("sets WorkingDirectory from the project root", () => {
    const unit = buildSystemdUnit(makeProject({ root: "/tmp/somewhere" }), config);
    assert.equal(unit.Service.WorkingDirectory, "/tmp/somewhere");
  });

  it("builds ExecStart from the sdn install root, the service entrypoint, and the project root", () => {
    const unit = buildSystemdUnit(makeProject({ root: "/tmp/project" }), { root: "/repo" });
    assert.equal(
      unit.Service.ExecStart,
      "/repo/src/service/node /repo/src/service/index.js /tmp/project"
    );
  });

  it("lets project.systemd override Unit.After and Install.WantedBy", () => {
    const project = makeProject({
      systemd: {
        Unit: { After: ["custom.target"] },
        Install: { WantedBy: ["graphical.target"] },
      },
    });
    const unit = buildSystemdUnit(project, config);
    assert.deepEqual(unit.Unit.After, ["custom.target"]);
    assert.deepEqual(unit.Install.WantedBy, ["graphical.target"]);
  });

  it("lets project.systemd add extra keys to Unit and Service", () => {
    const project = makeProject({
      systemd: {
        Unit: { Extra: "yes" },
        Service: { Restart: "always" },
      },
    });
    const unit = buildSystemdUnit(project, config);
    assert.equal(unit.Unit.Extra, "yes");
    assert.equal(unit.Service.Restart, "always");
  });

  it("always computes WorkingDirectory and ExecStart, even if project.systemd tries to override them", () => {
    const project = makeProject({
      root: "/tmp/project",
      systemd: {
        Service: { WorkingDirectory: "/should/not/win", ExecStart: "/should/not/win" },
      },
    });
    const unit = buildSystemdUnit(project, config);
    assert.equal(unit.Service.WorkingDirectory, "/tmp/project");
    assert.equal(unit.Service.ExecStart, "/repo/src/service/node /repo/src/service/index.js /tmp/project");
  });

  it("passes through extra top-level systemd sections", () => {
    const project = makeProject({ systemd: { Timer: { OnCalendar: "daily" } } });
    const unit = buildSystemdUnit(project, config);
    assert.deepEqual(unit.Timer, { OnCalendar: "daily" });
  });
});

describe("renderSystemdUnit", () => {
  it("renders sections as [Heading] blocks separated by blank lines", () => {
    const rendered = renderSystemdUnit({
      Unit: { Description: "desc" },
      Service: { Type: "simple" },
    });
    assert.equal(rendered, "[Unit]\nDescription=desc\n\n[Service]\nType=simple");
  });

  it("repeats the key for each entry of an array value", () => {
    const rendered = renderSystemdUnit({
      Unit: { After: ["network.target", "other.target"] },
    });
    assert.equal(rendered, "[Unit]\nAfter=network.target\nAfter=other.target");
  });

  it("round-trips a full unit built by buildSystemdUnit", () => {
    const unit = buildSystemdUnit(makeProject(), config);
    const rendered = renderSystemdUnit(unit);
    assert.match(rendered, /^\[Unit\]/);
    assert.match(rendered, /Description=desc/);
    assert.match(rendered, /After=network\.target/);
    assert.match(rendered, /\[Service\]/);
    assert.match(rendered, /Type=simple/);
    assert.match(rendered, /\[Install\]/);
    assert.match(rendered, /WantedBy=multi-user\.target/);
  });
});
