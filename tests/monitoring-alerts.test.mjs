import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMonitoringAlerts } from '../src/lib/monitoringAlerts.ts';
const rows = [
 {app_well_id:1,risk:0,tier:'alert',alert_id:31,alert_status:'new'},
 {app_well_id:2,risk:.1,tier:'watch',alert_id:32,alert_status:'acknowledged'},
 {app_well_id:3,risk:0,tier:null,alert_id:null,alert_status:null},
 {app_well_id:4,risk:null,tier:null,alert_id:null,alert_status:null,status:'insufficient'},
];
const ids = result => result.map(row => row.app_well_id);
test('attention follows stored tiers even at zero risk; all keeps nullable outcomes', () => {
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'attention','all')), [1,2]);
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'all','all')), [1,2,3,4]);
 assert.deepEqual(ids(rows), [1,2,3,4]);
});
test('normal never includes unscored and processing uses the real alert linkage', () => {
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'normal','all')), [3]);
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'unscored','all')), [4]);
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'all','new')), [1]);
 assert.deepEqual(ids(filterMonitoringAlerts(rows,'all','unlinked')), [3,4]);
 assert.deepEqual(ids(filterMonitoringAlerts([{...rows[0],alert_id:null}], 'all','new')), []);
});
