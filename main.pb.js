onRecordCreateExecute((e) => {
  // e.app
  // e.record
  const { record, meta } = e;
  console.log(JSON.stringify(e));
  const migration = e.request.url.query().get("migration");
  const migrationTime = e.request.url.query().get("time");

  if (migration && migrationTime) {
    record.set("created", migrationTime);
  }

  e.next();
}, "studyuren");
