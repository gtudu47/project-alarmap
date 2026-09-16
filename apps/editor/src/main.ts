import { bootstrapApplication } from '@angular/platform-browser';
import { MapShell, APP_MODE } from '../../ui/map-shell';

bootstrapApplication(MapShell, { providers: [{ provide: APP_MODE, useValue: 'editor' }] }).catch(console.error);
