import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Direktno uzmi token iz localStorage (bez AuthService-a!)
  const token = localStorage.getItem('auth_token');
  
  if (token) {
    // Kloniraj request i dodaj Authorization header
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  return next(req);
};