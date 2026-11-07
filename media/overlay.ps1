# Desktop overlay for the "chat heist" joke.
# A transparent, click-through, always-on-top window that never takes focus.
# The extension spawns this once and talks to it over stdin/stdout, one line per message:
#   in : heist <TAB> line <TAB> startXFrac <TAB> startYFromBottom <TAB> chatXFromRight <TAB> chatYFrac
#              <TAB> hasPanel <TAB> petX <TAB> groundY <TAB> minX <TAB> maxX   (panel position, screen DIPs)
#              <TAB> margin <TAB> endScale <TAB> base64 png
#   out: ready | kick (close the chat now) | done <screen x where it landed back in the panel>
param([string]$FontDir)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml
$refs = @(
  [System.Windows.Window].Assembly.Location,
  [System.Windows.Media.Brushes].Assembly.Location,
  [System.Windows.Threading.Dispatcher].Assembly.Location,
  [System.Xaml.XamlType].Assembly.Location
)

Add-Type -ReferencedAssemblies $refs -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;

public static class SidekickOverlay
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h, int i, int v);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);

    class Step
    {
        public double Ms;
        public Action Begin;
        public Action<double> Update; // t in 0..1
    }

    static Window win;
    static Canvas canvas;
    static Image pet;
    static ScaleTransform petScale = new ScaleTransform(1, 1);
    static RotateTransform petRot = new RotateTransform(0);
    static Border bubble;
    static TextBlock bubbleText;
    static FontFamily font;

    static List<Step> steps = new List<Step>();
    static int stepIndex = -1;
    static Stopwatch clock = new Stopwatch();

    // Pet position: where its feet are (bottom-center minus the PNG margin), in window coordinates.
    static double px, py;
    // Displayed size relative to the overlay PNG (endScale = same size as the pet in the panel).
    static double size = 1, baseW, baseH, margin, landLeft;

    public static void Run(string fontDir)
    {
        font = new FontFamily(new Uri(fontDir), "./#Gloria Hallelujah");

        win = new Window();
        win.WindowStyle = WindowStyle.None;
        win.AllowsTransparency = true;
        win.Background = Brushes.Transparent;
        win.Topmost = true;
        win.ShowInTaskbar = false;
        win.ShowActivated = false;
        win.Left = -20000; win.Top = -20000; win.Width = 10; win.Height = 10;

        canvas = new Canvas();
        win.Content = canvas;

        pet = new Image();
        var tg = new TransformGroup();
        tg.Children.Add(petScale);
        tg.Children.Add(petRot);
        pet.RenderTransform = tg;
        pet.RenderTransformOrigin = new Point(0.5, 0.7);
        pet.Effect = new DropShadowEffect { Color = Colors.Black, BlurRadius = 6, ShadowDepth = 0, Opacity = 0.9 };
        pet.Visibility = Visibility.Hidden;
        canvas.Children.Add(pet);

        bubbleText = new TextBlock { FontFamily = font, FontSize = 26, Foreground = Brushes.Black };
        bubble = new Border
        {
            Background = Brushes.White,
            BorderBrush = Brushes.Black,
            BorderThickness = new Thickness(2.5),
            CornerRadius = new CornerRadius(18, 6, 16, 8),
            Padding = new Thickness(16, 4, 16, 8),
            Child = bubbleText,
            RenderTransform = new RotateTransform(-3),
            Visibility = Visibility.Hidden,
        };
        canvas.Children.Add(bubble);

        win.SourceInitialized += delegate
        {
            // click-through (TRANSPARENT | LAYERED), never activates (NOACTIVATE), no alt-tab entry (TOOLWINDOW)
            IntPtr h = new WindowInteropHelper(win).Handle;
            int ex = GetWindowLong(h, -20);
            SetWindowLong(h, -20, ex | 0x20 | 0x80000 | 0x08000000 | 0x80);
        };
        CompositionTarget.Rendering += Tick;
        win.Show();

        var reader = new Thread(ReadLoop);
        reader.IsBackground = true;
        reader.Start();

        Send("ready");
        var app = new Application();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        app.Run();
    }

    static void Send(string s)
    {
        Console.Out.WriteLine(s);
        Console.Out.Flush();
    }

    static void ReadLoop()
    {
        var input = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        string line;
        while ((line = input.ReadLine()) != null)
        {
            string l = line;
            win.Dispatcher.BeginInvoke(new Action(delegate { Handle(l); }));
        }
        // Extension went away: quit.
        win.Dispatcher.BeginInvoke(new Action(delegate { Application.Current.Shutdown(); }));
    }

    static double Num(string s) { return double.Parse(s, CultureInfo.InvariantCulture); }

    static void Handle(string line)
    {
        string[] f = line.Split('\t');
        if (f[0] == "heist" && f.Length >= 14)
        {
            try { Heist(f[1], Num(f[2]), Num(f[3]), Num(f[4]), Num(f[5]), f[6] == "1", Num(f[7]), Num(f[8]), Num(f[9]), Num(f[10]), Num(f[11]), Num(f[12]), f[13]); }
            catch (Exception e) { Console.Error.WriteLine(e.ToString()); Send("done"); }
        }
    }

    static void Heist(string text, double startXFrac, double startYFromBottom, double chatXFromRight, double chatYFrac,
                      bool hasPanel, double panelPetX, double panelGroundY, double panelMinX, double panelMaxX,
                      double pngMargin, double endScale, string png)
    {
        // Cover the VS Code window (it's in the foreground: the user just pressed the shortcut there).
        RECT r;
        IntPtr fg = GetForegroundWindow();
        if (DwmGetWindowAttribute(fg, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(fg, out r);
        Matrix toDip = PresentationSource.FromVisual(win).CompositionTarget.TransformFromDevice;
        Point tl = toDip.Transform(new Point(r.Left, r.Top));
        Point br = toDip.Transform(new Point(r.Right, r.Bottom));
        win.Left = tl.X; win.Top = tl.Y;
        win.Width = br.X - tl.X; win.Height = br.Y - tl.Y;
        double W = win.Width, H = win.Height;
        landLeft = win.Left; // the window moves offscreen at the end, remember where it was

        var bmp = new BitmapImage();
        bmp.BeginInit();
        bmp.StreamSource = new MemoryStream(Convert.FromBase64String(png));
        bmp.CacheOption = BitmapCacheOption.OnLoad;
        bmp.EndInit();
        pet.Source = bmp;
        baseW = bmp.PixelWidth / 2.0;  // PNG is rendered at 2x
        baseH = bmp.PixelHeight / 2.0;
        margin = pngMargin;

        // Start at the pet's real spot in the panel (feet on the panel's ground line), at
        // the panel pet's size. Without panel info, fall back to the configured guess.
        double sx = hasPanel ? panelPetX - win.Left : W * startXFrac;
        double sy = hasPanel ? panelGroundY - win.Top : H - startYFromBottom;
        double cx = W - chatXFromRight, cy = H * chatYFrac;
        // Land straight below the kick, inside the panel's free stage area.
        double lx = hasPanel ? Math.Max(panelMinX - win.Left, Math.Min(panelMaxX - win.Left, cx)) : sx;
        double small = hasPanel ? endScale : 1;
        px = sx; py = sy; size = small;

        steps.Clear();
        // pop out of the panel: squash, then appear
        Add(160, delegate { pet.Visibility = Visibility.Visible; }, delegate (double t) {
            petScale.ScaleY = 1 - 0.25 * Math.Sin(Math.PI * t);
            size = Lerp(small, 1, Ease(t));
        });
        // three clumsy hops up to the chat
        for (int i = 1; i <= 3; i++)
        {
            double k0 = (i - 1) / 3.0, k1 = i / 3.0;
            Hop(Lerp(sx, cx, k0), Lerp(sy, cy, k0), Lerp(sx, cx, k1), Lerp(sy, cy, k1), i == 1 ? 160 : 90, 420, i % 2 == 0 ? -12 : 12);
            Add(90, null, delegate (double t) { petScale.ScaleY = 1 - 0.18 * Math.Sin(Math.PI * t); });
        }
        // it answers the chat before slamming it shut (silent typing — no per-character blips)
        Add(text.Length * 45 + 650, delegate { bubble.Visibility = Visibility.Visible; },
            delegate (double t) {
                double typing = text.Length * 45.0 / (text.Length * 45 + 650);
                int n = (int)Math.Ceiling(text.Length * Math.Min(1, t / typing));
                bubbleText.Text = text.Substring(0, n);
                petScale.ScaleY = 1 + 0.06 * Math.Sin(t * 40); // talking wobble
            });
        Add(10, delegate { bubble.Visibility = Visibility.Hidden; petScale.ScaleY = 1; }, null);
        // wind up (crouch + lean back), a fast explosive strike, an impact hold, then a
        // recoil that overshoots past upright before settling — one real hit, not a snap-back.
        Add(260, null, delegate (double t) {
            double e = Ease(t);
            petRot.Angle = -18 * e;
            petScale.ScaleY = 1 - 0.12 * e;
        });
        Add(70, null, delegate (double t) {
            double e = t * t; // accelerates hard into the strike
            petRot.Angle = -18 + 38 * e;
            px = cx + 38 * e;
            petScale.ScaleY = 1 - 0.12 * (1 - e);
        });
        Add(10, delegate { Send("kick"); Beep(150, 70); }, null);
        Add(110, null, delegate (double t) {
            // impact hold: it just hit something solid, so it barely moves for a beat
            petRot.Angle = 20 + Math.Sin(t * 40) * 1.5;
            px = cx + 38 + Math.Sin(t * 50) * 1.2;
        });
        Add(220, null, delegate (double t) {
            double e = Ease(t);
            petRot.Angle = Lerp(20, -6, e);
            px = cx + Lerp(38, -8, e);
        });
        Add(180, null, delegate (double t) {
            double e = Ease(t);
            petRot.Angle = Lerp(-6, 0, e);
            px = cx + Lerp(-8, 0, e);
        });
        // tumble back toward the panel — the spin eases out so it settles upright
        // instead of still spinning at full speed the instant it touches down.
        double fx = cx, fy = cy; // where the recoil leaves it
        Add(650, null, delegate (double t) {
            double e = Ease(t);
            px = Lerp(fx, lx, t);
            py = Lerp(fy, sy, t * t) - 70 * 4 * t * (1 - t); // small hop up, then gravity
            petRot.Angle = 360 * e;
            size = Lerp(1, small, e);
        });
        // impact: it compresses on landing, then a small residual bounce, right where it fell
        Add(90, null, delegate (double t) { petScale.ScaleY = 1 - 0.3 * Math.Sin(Math.PI * t); });
        Add(130, null, delegate (double t) {
            petScale.ScaleY = 1 - 0.1 * Math.Sin(Math.PI * t);
            py = sy - 9 * Math.Sin(Math.PI * t);
        });
        // hand over to the panel pet at exactly this spot
        Add(10, delegate {
            pet.Visibility = Visibility.Hidden;
            petRot.Angle = 0;
            petScale.ScaleY = 1;
            py = sy;
            win.Left = -20000; win.Top = -20000; win.Width = 10; win.Height = 10;
            Send("done " + (landLeft + lx).ToString(CultureInfo.InvariantCulture));
        }, null);

        stepIndex = -1;
        NextStep();
    }

    static double Lerp(double a, double b, double t) { return a + (b - a) * t; }
    static double Ease(double t) { return t * t * (3 - 2 * t); }

    // Fire-and-forget beep so it never blocks the WPF render thread.
    static void Beep(int freq, int ms)
    {
        ThreadPool.QueueUserWorkItem(delegate { try { Console.Beep(freq, ms); } catch { } });
    }

    static void Add(double ms, Action begin, Action<double> update)
    {
        steps.Add(new Step { Ms = ms, Begin = begin, Update = update });
    }

    static void Hop(double x0, double y0, double x1, double y1, double height, double ms, double spin)
    {
        Add(ms, null, delegate (double t) {
            px = Lerp(x0, x1, t);
            py = Lerp(y0, y1, t) - height * 4 * t * (1 - t);
            petRot.Angle = spin * Math.Sin(Math.PI * t);
            petScale.ScaleY = 1 + 0.08 * Math.Sin(Math.PI * t); // stretch mid-air
        });
    }

    static void NextStep()
    {
        stepIndex++;
        if (stepIndex >= steps.Count) { stepIndex = -1; return; }
        clock.Restart();
        if (steps[stepIndex].Begin != null) steps[stepIndex].Begin();
    }

    static void Tick(object sender, EventArgs e)
    {
        while (stepIndex >= 0)
        {
            Step s = steps[stepIndex];
            double t = Math.Min(1, clock.Elapsed.TotalMilliseconds / s.Ms);
            if (s.Update != null) s.Update(t);
            if (t < 1) break;
            NextStep();
        }
        pet.Width = baseW * size;
        pet.Height = baseH * size;
        Canvas.SetLeft(pet, px - pet.Width / 2);
        Canvas.SetTop(pet, py + margin * size - pet.Height); // feet on py
        if (bubble.Visibility == Visibility.Visible)
        {
            // bubble sits up-left of the pet, right edge anchored so typing grows leftwards
            bubble.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            Canvas.SetLeft(bubble, px - pet.Width / 2 - bubble.DesiredSize.Width + 10);
            Canvas.SetTop(bubble, py - pet.Height - bubble.DesiredSize.Height + 10);
        }
    }
}
'@

[SidekickOverlay]::Run($FontDir)
